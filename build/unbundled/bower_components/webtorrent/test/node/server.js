var fixtures=require("webtorrent-fixtures"),fs=require("fs"),get=require("simple-get"),test=require("tape"),WebTorrent=require("../../");test("torrent.createServer: programmatic http server",function(e){e.plan(9);var r=new WebTorrent({tracker:!1,dht:!1});r.on("error",function(r){e.fail(r)}),r.on("warning",function(r){e.fail(r)}),r.add(fixtures.leaves.torrent,function(t){e.pass('got "torrent" event');var n=t.createServer();n.listen(0,function(){var o=n.address().port;e.pass("server is listening on "+o),t.load(fs.createReadStream(fixtures.leaves.contentPath),function(r){e.error(r,"loaded seed content into torrent")});var s="http://localhost:"+o;get.concat(s+"/",function(t,o,a){e.error(t,"got http response for /"),a=a.toString(),e.ok(a.indexOf("Leaves of Grass by Walt Whitman.epub")!==-1),get.concat(s+"/0",function(t,o,s){e.error(t,"got http response for /0"),e.deepEqual(s,fixtures.leaves.content),n.close(function(){e.pass("server closed")}),r.destroy(function(r){e.error(r,"client destroyed")})})})})})});