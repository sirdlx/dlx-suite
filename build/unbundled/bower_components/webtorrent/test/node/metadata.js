var fixtures=require("webtorrent-fixtures"),test=require("tape"),WebTorrent=require("../../");test("ut_metadata transfer",function(e){e.plan(6);var r=new WebTorrent({dht:!1,tracker:!1}),t=new WebTorrent({dht:!1,tracker:!1});r.on("error",function(r){e.fail(r)}),r.on("warning",function(r){e.fail(r)}),t.on("error",function(r){e.fail(r)}),t.on("warning",function(r){e.fail(r)}),r.on("torrent",function(r){e.pass("client1 emits torrent event"),e.ok(r.metadata,"metadata exists")}),r.add(fixtures.leaves.torrent),r.on("torrent",function(n){e.deepEqual(n.info,fixtures.leaves.parsedTorrent.info);var o=t.add(fixtures.leaves.parsedTorrent.infoHash);o.on("infoHash",function(){o.addPeer("127.0.0.1:"+r.address().port),t.on("torrent",function(){e.deepEqual(n.info,o.info),r.destroy(function(r){e.error(r,"client1 destroyed")}),t.destroy(function(r){e.error(r,"client2 destroyed")})})})})});