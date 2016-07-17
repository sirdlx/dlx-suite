var fixtures=require("webtorrent-fixtures"),test=require("tape"),WebTorrent=require("../../");test("extension support",function(e){function r(e){e.extendedHandshake.test="Hello, World!"}e.plan(6);var n=0;r.prototype.name="wt_test",r.prototype.onExtendedHandshake=function(r){n+=1,e.equal(r.test.toString(),"Hello, World!","handshake.test === Hello, World!"),2===n&&(t.destroy(function(r){e.error(r,"client1 destroyed")}),o.destroy(function(r){e.error(r,"client2 destroyed")}))};var t=new WebTorrent({dht:!1,tracker:!1});t.on("error",function(r){e.fail(r)}),t.on("warning",function(r){e.fail(r)});var o=new WebTorrent({dht:!1,tracker:!1});o.on("error",function(r){e.fail(r)}),o.on("warning",function(r){e.fail(r)}),t.add(fixtures.leaves.parsedTorrent,function(n){n.on("wire",function(n){e.pass("client1 onWire"),n.use(r)});var i=o.add(fixtures.leaves.parsedTorrent.infoHash);i.on("wire",function(n){e.pass("client2 onWire"),n.use(r)}),i.on("infoHash",function(){i.addPeer("127.0.0.1:"+t.address().port)})})});