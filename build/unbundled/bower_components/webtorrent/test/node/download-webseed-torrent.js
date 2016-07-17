var extend=require("xtend"),finalhandler=require("finalhandler"),fixtures=require("webtorrent-fixtures"),http=require("http"),path=require("path"),series=require("run-series"),serveStatic=require("serve-static"),test=require("tape"),WebTorrent=require("../../");test("Download using webseed (via .torrent file)",function(e){e.plan(6);var r,t=extend(fixtures.leaves.parsedTorrent),n=http.createServer(function(e,r){var t=finalhandler(e,r);serveStatic(path.join(__dirname,"content"))(e,r,t)});n.on("error",function(r){e.fail(r)}),series([function(e){n.listen(e)},function(o){t.urlList=["http://localhost:"+n.address().port+"/"+fixtures.leaves.parsedTorrent.name],r=new WebTorrent({dht:!1,tracker:!1}),r.on("error",function(r){e.fail(r)}),r.on("warning",function(r){e.fail(r)}),r.on("torrent",function(r){function t(){n&&i&&o(null)}r.files.forEach(function(r){r.getBuffer(function(r,o){e.error(r),e.deepEqual(o,fixtures.leaves.content,"downloaded correct content"),n=!0,t()})}),r.once("done",function(){e.pass("client downloaded torrent from webseed"),i=!0,t()});var n=!1,i=!1}),r.add(t)}],function(t){e.error(t),r.destroy(function(r){e.error(r,"client destroyed")}),n.close(function(){e.pass("http server closed")})})});