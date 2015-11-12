# retry-log

reprocess errors in a log so you dont have to stop real time processing to wait.

- so your process puts jobs it has a problem handling "real time" into a log file.
- some time in the future you want to try them again. maybe up to a number of times
- this will handle making sure no tasks get lost. 
- It neatly files them into either a "failed.log" or a "fixed.log" after 3 attepots

```js
var processLog = require('retry-log')
var retryJob = require('your magic function that performs work')

var log = "./problems.log"

retry(log,function(data,cb){
  retryJob(data,cb)
},function(){
  console.log('all done processing')
})

```

API
---

- retry(options,handler,done)
  - returns undefined
  - options
    - string, log file name
    - object
      - tries: 3, the number of times each job should be tried.
      - log: required. the log file to process
      - failedLog: the log file to write failed tasks
      - fixedLog: the log file to write fixed tasks
      - pid: optional, the pid of the process that writes the source log file.
      - rotateSignal: SIGHUP. if pid is provided this signal is delivered to the process. It is expected that it get a new handle to the log file because it will be moved and unlinked as part of managing the retries.


