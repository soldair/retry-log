var fs = require('fs')
var path = require('path')
var t2 = require('through2')
var s2 = require('split2')
var eos = require('end-of-stream')
var once = require('once')
var ts = require('monotonic-timestamp')
var readmany = require('fs-readstream-many')


module.exports = function(options,processFn,done){
  done = once(done)
  var jobKey = ts()

  options = options||{}
  if(typeof options === 'string') options = {log:options}

  // this process moves the target log file and sends a SIGHUP to the process with this pid 
  // so that it knows to get a new handle to it's log.
  var pid = options.pid

  // the log file path where new events are written
  var sourceLog = options.log

  // the number of tries before the job is moved to "failed"
  var maxAttempts = options.tries

  if(!sourceLog) return setImmediate(function(){
    done(new Error('missing options.log'))
  })

  var dir = path.dirname(sourceLog)
  var compactName = sourceLog+'.data_'+jobKey

  var failedLog = path.resolve(dir,options.failedLog||path.join(dir,'failed.log')) 
  var fixedLog = path.resolve(dir,options.failedLog||path.join(dir,'failed.log'))

  maybeRename(sourceLog,compactName,function(err,renamed){
    if(err) return done(err)

    // i still have related logs i may need to process
    //if(!renamed) return done(false)

    // tell any writing process to release the file.
    if(pid) process.kill(pid,"SIGHUP")


    // errLog
    var failedStream = fs.createWriteStream(failedLog,{flags:'a+'})
    // fixedLog
    var fixedStream = fs.createWriteStream(fixedLog,{flags:'a+'})
    // nextLog - this log gets renamed into place then all of the source files are deleted
    var nextLogName = sourceLog+'.tmp_'+jobKey;
    var nextLog = fs.createWriteStream(nextLogName)

    var doingWork = workStream(processFn,sourceLog+'.data_',boundWrite(failedStream),boundWrite(fixedStream),boundWrite(nextLog))

    doingWork.maxAttempts(maxAttempts)

    var processedFiles;
    doingWork.on('files',function(files){
      processedFiles = files
    })


    eos(doingWork,function(err){


      if(err || !nextLog.bytesWritten) {
        processedFiles.push(nextLogName)
        return clean(err)
      }

      // make sure nextLog is picked up for work on the next iteration
      fs.rename(nextLogName,compactName+'_result',clean)

      function clean(err) {
        if(err) return done(err)

        if(!processedFiles.length) return done()

        var cleanup = processedFiles.length
        var cleanupErrors = []


        while(processedFiles.length) fs.unlink(processedFiles.shift(),function(err){
          if(err) cleanupErrors.push(err)
          if(!--cleanup) {
            if(cleanupErrors.length) err = new Error('failed to cleanup all files! going to be reprocessing forever!')
            done(err)
          }
        })     
      }
  

    })

  })
}

function workStream(handler,prefix,errLog,fixedLog,nextLog){


  var maxAttempts = 3;

  var through = t2.obj(function(chunk,enc,cb){
    var o = json(chunk)
    if(!o) {
      o = {error:"corrupt",data:chunk+''}
      // write this to failedlog
      return errLog(o,function(){
        cb()
      })
    }

    handler(o,function(err,result){
      if(!o.tries) o.tries = 0 

      if(err) {


        if(!o.attempts) o.attempts = [];
        o.attempts[o.tries] = {err:err+'',result:result}

        if(++o.tries >= maxAttempts) { 
          return errLog(o,function(err){
            cb(err)
          })
        } else {
          return nextLog(o,function(err){
            cb(err)
          })
        }    
      }

      // log as success!
      fixedLog(o,function(err){
        cb(err)
      })
    })
  })

  var split = s2()

  var file = readmany(prefix+'*')

  file.on('files',function(files){
    through.emit('files',files)
  })

  eos(split,function(err){
    if(err) through.emit('error',err)
  })

  eos(file,function(err){
    if(err) through.emit('error',err)
  })

  file.pipe(split).pipe(through)

  through.maxAttempts = function(v){
    if(v !== undefined) maxAttempts = +v
    return maxAttempts
  }

  through.on('data',function(){})

  return through
}

// if the file has any data in it
function maybeRename(file,toName,cb){
  fs.stat(file,function(err,stat){
    if(err && err.code !== 'ENOENT') return cb(err)
    else if(err) return cb(false) 
    if(stat.size === 0) cb(false)

    // ok the file exists and there is data in it.
    
    fs.rename(file,toName,function(err){
      cb(err,true);// if there is no error you should process the new file.
    })

  })
}

function boundWrite(s){
  return function(o,cb){
    s.write(JSON.stringify(o)+"\n",cb)
  }
}

function json(s){
  try{
    return JSON.parse(s)
  } catch (e) {}
}
