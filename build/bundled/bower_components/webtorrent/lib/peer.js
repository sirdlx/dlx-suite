function Peer(e,n){var r=this;r.id=e,r.type=n,debug("new Peer %s",e),r.addr=null,r.conn=null,r.swarm=null,r.wire=null,r.connected=!1,r.destroyed=!1,r.timeout=null,r.retries=0,r.sentHandshake=!1}function noop(){}var arrayRemove=require("unordered-array-remove"),debug=require("debug")("webtorrent:peer"),Wire=require("bittorrent-protocol"),WebConn=require("./webconn"),CONNECT_TIMEOUT_TCP=5e3,CONNECT_TIMEOUT_WEBRTC=25e3,HANDSHAKE_TIMEOUT=25e3;exports.createWebRTCPeer=function(e,n){var r=new Peer(e.id,"webrtc");return r.conn=e,r.swarm=n,r.conn.connected?r.onConnect():(r.conn.once("connect",function(){r.onConnect()}),r.conn.once("error",function(e){r.destroy(e)}),r.startConnectTimeout()),r},exports.createTCPIncomingPeer=function(e){var n=e.remoteAddress+":"+e.remotePort,r=new Peer(n,"tcpIncoming");return r.conn=e,r.addr=n,r.onConnect(),r},exports.createTCPOutgoingPeer=function(e,n){var r=new Peer(e,"tcpOutgoing");return r.addr=e,r.swarm=n,r},exports.createWebSeedPeer=function(e,n){var r=new Peer(e,"webSeed");return r.swarm=n,r.conn=new WebConn(e,n),r.onConnect(),r},Peer.prototype.onConnect=function(){var e=this;if(!e.destroyed){e.connected=!0,debug("Peer %s connected",e.id),clearTimeout(e.connectTimeout);var n=e.conn;n.once("end",function(){e.destroy()}),n.once("close",function(){e.destroy()}),n.once("finish",function(){e.destroy()}),n.once("error",function(n){e.destroy(n)});var r=e.wire=new Wire;r.type=e.type,r.once("end",function(){e.destroy()}),r.once("close",function(){e.destroy()}),r.once("finish",function(){e.destroy()}),r.once("error",function(n){e.destroy(n)}),r.once("handshake",function(n,r){e.onHandshake(n,r)}),e.startHandshakeTimeout(),n.pipe(r).pipe(n),e.swarm&&!e.sentHandshake&&e.handshake()}},Peer.prototype.onHandshake=function(e,n){var r=this;if(r.swarm&&!r.destroyed){if(r.swarm.destroyed)return r.destroy(new Error("swarm already destroyed"));if(e!==r.swarm.infoHash)return r.destroy(new Error("unexpected handshake info hash for this swarm"));if(n===r.swarm.peerId)return r.destroy(new Error("refusing to connect to ourselves"));debug("Peer %s got handshake %s",r.id,e),clearTimeout(r.handshakeTimeout),r.retries=0;var o=r.addr;!o&&r.conn.remoteAddress&&(o=r.conn.remoteAddress+":"+r.conn.remotePort),r.swarm._onWire(r.wire,o),r.swarm&&!r.swarm.destroyed&&(r.sentHandshake||r.handshake())}},Peer.prototype.handshake=function(){var e=this,n={dht:!e.swarm.private&&!!e.swarm.client.dht};e.wire.handshake(e.swarm.infoHash,e.swarm.client.peerId,n),e.sentHandshake=!0},Peer.prototype.startConnectTimeout=function(){var e=this;clearTimeout(e.connectTimeout),e.connectTimeout=setTimeout(function(){e.destroy(new Error("connect timeout"))},"webrtc"===e.type?CONNECT_TIMEOUT_WEBRTC:CONNECT_TIMEOUT_TCP),e.connectTimeout.unref&&e.connectTimeout.unref()},Peer.prototype.startHandshakeTimeout=function(){var e=this;clearTimeout(e.handshakeTimeout),e.handshakeTimeout=setTimeout(function(){e.destroy(new Error("handshake timeout"))},HANDSHAKE_TIMEOUT),e.handshakeTimeout.unref&&e.handshakeTimeout.unref()},Peer.prototype.destroy=function(e){var n=this;if(!n.destroyed){n.destroyed=!0,n.connected=!1,debug("destroy %s (error: %s)",n.id,e&&(e.message||e)),clearTimeout(n.connectTimeout),clearTimeout(n.handshakeTimeout);var r=n.swarm,o=n.conn,t=n.wire;n.swarm=null,n.conn=null,n.wire=null,r&&t&&arrayRemove(r.wires,r.wires.indexOf(t)),o&&(o.on("error",noop),o.destroy()),t&&t.destroy(),r&&r.removePeer(n.id)}};