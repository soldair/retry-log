# retry-log

Process events in a log. Retry them a number of times. Then file them into failed.log or fixed.log

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


Files
-----

this manages marshalling events in a log file to either a failed log or a fixed log

### the log file.
- the log file must contain newline delimited json
- this module reserves 2 keys on this object. "tries" and "attempts"
    - "tries" is a number that incrments with each attempt
    - "attempts" is an array of `{error:,data:}` objects with the results of each attempt.

### log life cycle
- create job id (`monotonic-timestamp`)
- rename log file to `logname+".data_"+jobId`
- if pid is provided, signal pid and blindly trust that it releases the file descriptor
- create a read stream with `fs-readstream-many` which is exactly the same as`cat $logname.data_*`
- as each line is processed based on the result write to one of 3 logs. 
  - if the job passes the line is appended to `fixed.log`
  - if the job fails and there are no more chances the line is appended to `failed.log` 
  - if the job failed but still has more chances. the line gets added to `logname+".tmp_"+jobId`
- after all jobs are complete if any lines have been written to the new retry log move `logname+".tmp_"+jobId` to `logname+".data_"+jobId+"_result"`
- unlink all other `logname+".data_*` logs that were processed
