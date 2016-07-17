function assertBlocked(e,t,r){t.once("blockedPeer",function(t){e.equal(r,t)}),e.notOk(t.addPeer(r))}function assertReachable(e,t,r){t.once("peer",function(t){e.equal(r,t)}),e.ok(t.addPeer(r))}function assertList(e,t){assertBlocked(e,t,"1.2.3.0:1234"),assertBlocked(e,t,"1.2.3.0:6969"),assertBlocked(e,t,"1.2.3.1:1234"),assertBlocked(e,t,"1.2.3.1:6969"),assertBlocked(e,t,"1.2.3.1:1234"),assertBlocked(e,t,"1.2.3.1:6969"),assertBlocked(e,t,"1.2.3.254:1234"),assertBlocked(e,t,"1.2.3.254:6969"),assertBlocked(e,t,"1.2.3.255:1234"),assertBlocked(e,t,"1.2.3.255:6969"),assertBlocked(e,t,"5.6.7.0:1234"),assertBlocked(e,t,"5.6.7.0:6969"),assertBlocked(e,t,"5.6.7.128:1234"),assertBlocked(e,t,"5.6.7.128:6969"),assertBlocked(e,t,"5.6.7.255:1234"),assertBlocked(e,t,"5.6.7.255:6969"),assertReachable(e,t,"1.1.1.1:1234"),assertReachable(e,t,"1.1.1.1:6969"),assertReachable(e,t,"2.2.2.2:1234"),assertReachable(e,t,"2.2.2.2:6969"),assertReachable(e,t,"1.2.4.0:1234"),assertReachable(e,t,"1.2.4.0:6969"),assertReachable(e,t,"1.2.2.0:1234"),assertReachable(e,t,"1.2.2.0:6969")}var fixtures=require("webtorrent-fixtures"),fs=require("fs"),http=require("http"),test=require("tape"),WebTorrent=require("../../"),zlib=require("zlib");test("blocklist (single IP)",function(e){e.plan(9);var t=new WebTorrent({dht:!1,tracker:!1,blocklist:["1.2.3.4"]});t.on("error",function(t){e.fail(t)}),t.on("warning",function(t){e.fail(t)}),t.on("ready",function(){t.add(fixtures.leaves.parsedTorrent,function(r){assertBlocked(e,r,"1.2.3.4:1234"),assertBlocked(e,r,"1.2.3.4:6969"),assertReachable(e,r,"1.1.1.1:1234"),assertReachable(e,r,"1.1.1.1:6969"),t.destroy(function(t){e.error(t,"client destroyed")})})})}),test("blocklist (array of IPs)",function(e){e.plan(13);var t=new WebTorrent({dht:!1,tracker:!1,blocklist:["1.2.3.4","5.6.7.8"]}).on("error",function(t){e.fail(t)}).on("warning",function(t){e.fail(t)}).on("ready",function(){t.add(fixtures.leaves.parsedTorrent,function(r){assertBlocked(e,r,"1.2.3.4:1234"),assertBlocked(e,r,"1.2.3.4:6969"),assertBlocked(e,r,"5.6.7.8:1234"),assertBlocked(e,r,"5.6.7.8:6969"),assertReachable(e,r,"1.1.1.1:1234"),assertReachable(e,r,"1.1.1.1:6969"),t.destroy(function(t){e.error(t,"client destroyed")})})})}),test("blocklist (array of IP ranges)",function(e){e.plan(49);var t=new WebTorrent({dht:!1,tracker:!1,blocklist:[{start:"1.2.3.0",end:"1.2.3.255"},{start:"5.6.7.0",end:"5.6.7.255"}]}).on("error",function(t){e.fail(t)}).on("warning",function(t){e.fail(t)}).on("ready",function(){t.add(fixtures.leaves.parsedTorrent,function(r){assertList(e,r),t.destroy(function(t){e.error(t,"client destroyed")})})})}),test("blocklist (http url)",function(e){e.plan(51);var t=http.createServer(function(t,r){e.ok(t.headers["user-agent"].indexOf("WebTorrent")!==-1),fs.createReadStream(fixtures.blocklist.path).pipe(r)});t.listen(0,function(){var r=t.address().port,n="http://127.0.0.1:"+r,s=new WebTorrent({dht:!1,tracker:!1,blocklist:n}).on("error",function(t){e.fail(t)}).on("warning",function(t){e.fail(t)}).on("ready",function(){s.add(fixtures.leaves.parsedTorrent,function(r){assertList(e,r),s.destroy(function(t){e.error(t,"client destroyed")}),t.close(function(){e.pass("server closed")})})})})}),test("blocklist (http url with gzip encoding)",function(e){e.plan(51);var t=http.createServer(function(t,r){e.ok(t.headers["user-agent"].indexOf("WebTorrent")!==-1),r.setHeader("content-encoding","gzip"),fs.createReadStream(fixtures.blocklist.path).pipe(zlib.createGzip()).pipe(r)});t.listen(0,function(){var r=t.address().port,n="http://127.0.0.1:"+r,s=new WebTorrent({dht:!1,tracker:!1,blocklist:n}).on("error",function(t){e.fail(t)}).on("warning",function(t){e.fail(t)}).on("ready",function(){s.add(fixtures.leaves.parsedTorrent,function(r){assertList(e,r),s.destroy(function(t){e.error(t,"client destroyed")}),t.close(function(){e.pass("server closed")})})})})}),test("blocklist (http url with deflate encoding)",function(e){e.plan(51);var t=http.createServer(function(t,r){e.ok(t.headers["user-agent"].indexOf("WebTorrent")!==-1),r.setHeader("content-encoding","deflate"),fs.createReadStream(fixtures.blocklist.path).pipe(zlib.createDeflate()).pipe(r)});t.listen(0,function(){var r=t.address().port,n="http://127.0.0.1:"+r,s=new WebTorrent({dht:!1,tracker:!1,blocklist:n}).on("error",function(t){e.fail(t)}).on("warning",function(t){e.fail(t)}).on("ready",function(){s.add(fixtures.leaves.parsedTorrent,function(r){assertList(e,r),s.destroy(function(t){e.error(t,"client destroyed")}),t.close(function(){e.pass("server closed")})})})})}),test("blocklist (fs path)",function(e){e.plan(49);var t=new WebTorrent({dht:!1,tracker:!1,blocklist:fixtures.blocklist.path}).on("error",function(t){e.fail(t)}).on("warning",function(t){e.fail(t)}).on("ready",function(){t.add(fixtures.leaves.parsedTorrent,function(r){assertList(e,r),t.destroy(function(t){e.error(t,"client destroyed")})})})}),test("blocklist (fs path with gzip)",function(e){e.plan(49);var t=new WebTorrent({dht:!1,tracker:!1,blocklist:fixtures.blocklist.gzipPath}).on("error",function(t){e.fail(t)}).on("warning",function(t){e.fail(t)}).on("ready",function(){t.add(fixtures.leaves.parsedTorrent,function(r){assertList(e,r),t.destroy(function(t){e.error(t,"client destroyed")})})})});