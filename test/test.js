var test = require('tape')
var fs = require('fs')
var retry = require('../')

var rimraf = require('rimraf')

test("can",function(t){

  var name = __dirname+'/'+Math.random()+'.log'

  fs.writeFileSync(name,'{"seq":1,"data":"foo"}\n{"seq":1,"data":"bar"}\n{"seq":1,"data":"baz"}\n')

  //
  
  retry(name,function(data,cb){
    console.log(data)
    cb('error')
  },function(){
    console.log('end1')
    retry(name,function(data,cb){
      console.log(data)
      cb('error')
    },function(data,cb){

      console.log('end2')
      retry(name,function(data,cb){
        console.log(data)
        cb('error')
      },function(data,cb){

        console.log('end3')
        retry(name,function(data,cb){
          console.log(data)
          cb('error')
        },function(data,cb){

          console.log('end')
          t.end()
        })
      })

    })
  })


})
