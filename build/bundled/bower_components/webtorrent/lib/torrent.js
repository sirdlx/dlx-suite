function Torrent(e,t,r){EventEmitter.call(this),this.client=t,this._debugId=this.client.peerId.slice(32),this._debug("new torrent"),this.announce=r.announce,this.urlList=r.urlList,this.path=r.path,this._store=r.store||FSChunkStore,this._getAnnounceOpts=r.getAnnounceOpts,this.strategy=r.strategy||"sequential",this.maxWebConns=r.maxWebConns||4,this._rechokeNumSlots=r.uploads===!1||0===r.uploads?0:+r.uploads||10,this._rechokeOptimisticWire=null,this._rechokeOptimisticTime=0,this._rechokeIntervalId=null,this.ready=!1,this.destroyed=!1,this.paused=!1,this.done=!1,this.metadata=null,this.store=null,this.files=[],this.pieces=[],this._amInterested=!1,this._selections=[],this._critical=[],this.wires=[],this._queue=[],this._peers={},this._peersLength=0,this.received=0,this.uploaded=0,this._downloadSpeed=speedometer(),this._uploadSpeed=speedometer(),this._servers=[],this._xsRequests=[],this._fileModtimes=r.fileModtimes,null!==e&&this._onTorrentId(e)}function getBlockPipelineLength(e,t){return 2+Math.ceil(t*e.downloadSpeed()/Piece.BLOCK_LENGTH)}function getPiecePipelineLength(e,t,r){return 1+Math.ceil(t*e.downloadSpeed()/r)}function randomInt(e){return Math.random()*e|0}function noop(){}module.exports=Torrent;var addrToIPPort=require("addr-to-ip-port"),BitField=require("bitfield"),ChunkStoreWriteStream=require("chunk-store-stream/write"),debug=require("debug")("webtorrent:torrent"),Discovery=require("torrent-discovery"),EventEmitter=require("events").EventEmitter,extend=require("xtend"),extendMutable=require("xtend/mutable"),fs=require("fs"),FSChunkStore=require("fs-chunk-store"),get=require("simple-get"),ImmediateChunkStore=require("immediate-chunk-store"),inherits=require("inherits"),MultiStream=require("multistream"),net=require("net"),os=require("os"),parallel=require("run-parallel"),parallelLimit=require("run-parallel-limit"),parseTorrent=require("parse-torrent"),path=require("path"),Piece=require("torrent-piece"),pump=require("pump"),randomIterate=require("random-iterate"),sha1=require("simple-sha1"),speedometer=require("speedometer"),uniq=require("uniq"),utMetadata=require("ut_metadata"),utPex=require("ut_pex"),File=require("./file"),Peer=require("./peer"),RarityMap=require("./rarity-map"),Server=require("./server"),MAX_BLOCK_LENGTH=131072,PIECE_TIMEOUT=3e4,CHOKE_TIMEOUT=5e3,SPEED_THRESHOLD=3*Piece.BLOCK_LENGTH,PIPELINE_MIN_DURATION=.5,PIPELINE_MAX_DURATION=1,RECHOKE_INTERVAL=1e4,RECHOKE_OPTIMISTIC_DURATION=2,FILESYSTEM_CONCURRENCY=2,RECONNECT_WAIT=[1e3,5e3,15e3],VERSION=require("../package.json").version,TMP;try{TMP=path.join(fs.statSync("/tmp")&&"/tmp","webtorrent")}catch(e){TMP=path.join("function"==typeof os.tmpDir?os.tmpDir():"/","webtorrent")}inherits(Torrent,EventEmitter),Object.defineProperty(Torrent.prototype,"timeRemaining",{get:function(){return this.done?0:0===this.downloadSpeed?1/0:(this.length-this.downloaded)/this.downloadSpeed*1e3}}),Object.defineProperty(Torrent.prototype,"downloaded",{get:function(){if(!this.bitfield)return 0;for(var e=0,t=0,r=this.pieces.length;t<r;++t)if(this.bitfield.get(t))e+=t===r-1?this.lastPieceLength:this.pieceLength;else{var n=this.pieces[t];e+=n.length-n.missing}return e}}),Object.defineProperty(Torrent.prototype,"downloadSpeed",{get:function(){return this._downloadSpeed()}}),Object.defineProperty(Torrent.prototype,"uploadSpeed",{get:function(){return this._uploadSpeed()}}),Object.defineProperty(Torrent.prototype,"progress",{get:function(){return this.length?this.downloaded/this.length:0}}),Object.defineProperty(Torrent.prototype,"ratio",{get:function(){return this.uploaded/(this.received||1)}}),Object.defineProperty(Torrent.prototype,"numPeers",{get:function(){return this.wires.length}}),Object.defineProperty(Torrent.prototype,"torrentFileBlobURL",{get:function(){if("undefined"==typeof window)throw new Error("browser-only property");return this.torrentFile?URL.createObjectURL(new Blob([this.torrentFile],{type:"application/x-bittorrent"})):null}}),Object.defineProperty(Torrent.prototype,"_numQueued",{get:function(){return this._queue.length+(this._peersLength-this._numConns)}}),Object.defineProperty(Torrent.prototype,"_numConns",{get:function(){var e=this,t=0;for(var r in e._peers)e._peers[r].connected&&(t+=1);return t}}),Object.defineProperty(Torrent.prototype,"swarm",{get:function(){return console.warn("WebTorrent: `torrent.swarm` is deprecated. Use `torrent` directly instead."),this}}),Torrent.prototype._onTorrentId=function(e){var t=this;if(!t.destroyed){var r;try{r=parseTorrent(e)}catch(e){}r?(t.infoHash=r.infoHash,process.nextTick(function(){t.destroyed||t._onParsedTorrent(r)})):parseTorrent.remote(e,function(e,r){if(!t.destroyed)return e?t._destroy(e):void t._onParsedTorrent(r)})}},Torrent.prototype._onParsedTorrent=function(e){var t=this;if(!t.destroyed){if(t._processParsedTorrent(e),!t.infoHash)return t._destroy(new Error("Malformed torrent data: No info hash"));t.path||(t.path=path.join(TMP,t.infoHash)),t._rechokeIntervalId=setInterval(function(){t._rechoke()},RECHOKE_INTERVAL),t._rechokeIntervalId.unref&&t._rechokeIntervalId.unref(),t.emit("_infoHash",t.infoHash),t.destroyed||(t.emit("infoHash",t.infoHash),t.destroyed||(t.client.listening?t._onListening():t.client.once("listening",function(){t._onListening()})))}},Torrent.prototype._processParsedTorrent=function(e){this.announce&&(e.announce=e.announce.concat(this.announce)),this.client.tracker&&global.WEBTORRENT_ANNOUNCE&&!this.private&&(e.announce=e.announce.concat(global.WEBTORRENT_ANNOUNCE)),this.urlList&&(e.urlList=e.urlList.concat(this.urlList)),uniq(e.announce),uniq(e.urlList),extendMutable(this,e),this.magnetURI=parseTorrent.toMagnetURI(e),this.torrentFile=parseTorrent.toTorrentFile(e)},Torrent.prototype._onListening=function(){function e(e){i._destroy(e)}function t(e){"string"==typeof e&&i.done||i.addPeer(e)}function r(){i.emit("trackerAnnounce"),0===i.numPeers&&i.emit("noPeers","tracker")}function n(){i.emit("dhtAnnounce"),0===i.numPeers&&i.emit("noPeers","dht")}function o(e){i.emit("warning",e)}var i=this;if(!i.discovery&&!i.destroyed){var s=i.client.tracker;s&&(s=extend(i.client.tracker,{getAnnounceOpts:function(){var e={uploaded:i.uploaded,downloaded:i.downloaded,left:Math.max(i.length-i.downloaded,0)};return i.client.tracker.getAnnounceOpts&&extendMutable(e,i.client.tracker.getAnnounceOpts()),i._getAnnounceOpts&&extendMutable(e,i._getAnnounceOpts()),e}})),i.discovery=new Discovery({infoHash:i.infoHash,announce:i.announce,peerId:i.client.peerId,dht:!i.private&&i.client.dht,tracker:s,port:i.client.torrentPort}),i.discovery.on("error",e),i.discovery.on("peer",t),i.discovery.on("trackerAnnounce",r),i.discovery.on("dhtAnnounce",n),i.discovery.on("warning",o),i.info?i._onMetadata(i):i.xs&&i._getMetadataFromServer()}},Torrent.prototype._getMetadataFromServer=function(){function e(e,r){function n(n,o,i){if(t.destroyed)return r(null);if(t.metadata)return r(null);if(n)return t._debug("http error from xs param: %s",e),r(null);if(200!==o.statusCode)return t._debug("non-200 status code %s from xs param: %s",o.statusCode,e),r(null);var s;try{s=parseTorrent(i)}catch(e){}return s?s.infoHash!==t.infoHash?(t._debug("got torrent file with incorrect info hash from xs param: %s",e),r(null)):(t._onMetadata(s),void r(null)):(t._debug("got invalid torrent file from xs param: %s",e),r(null))}if(0!==e.indexOf("http://")&&0!==e.indexOf("https://"))return t._debug("skipping non-http xs param: %s",e),r(null);var o,i={url:e,method:"GET",headers:{"user-agent":"WebTorrent/"+VERSION+" (https://webtorrent.io)"}};try{o=get.concat(i,n)}catch(n){return t._debug("skipping invalid url xs param: %s",e),r(null)}t._xsRequests.push(o)}var t=this,r=Array.isArray(t.xs)?t.xs:[t.xs],n=r.map(function(t){return function(r){e(t,r)}});parallel(n)},Torrent.prototype._onMetadata=function(e){var t=this;if(!t.metadata&&!t.destroyed){t._debug("got metadata"),t._xsRequests.forEach(function(e){e.abort()}),t._xsRequests=[];var r;if(e&&e.infoHash)r=e;else try{r=parseTorrent(e)}catch(e){return t._destroy(e)}t._processParsedTorrent(r),t.metadata=t.torrentFile,t.urlList.forEach(function(e){t.addWebSeed(e)}),t._rarityMap=new RarityMap(t),t.store=new ImmediateChunkStore(new t._store(t.pieceLength,{torrent:{infoHash:t.infoHash},files:t.files.map(function(e){return{path:path.join(t.path,e.path),length:e.length,offset:e.offset}}),length:t.length})),t.files=t.files.map(function(e){return new File(t,e)}),t._hashes=t.pieces,t.pieces=t.pieces.map(function(e,r){var n=r===t.pieces.length-1?t.lastPieceLength:t.pieceLength;return new Piece(n)}),t._reservations=t.pieces.map(function(){return[]}),t.bitfield=new BitField(t.pieces.length),t.wires.forEach(function(e){e.ut_metadata&&e.ut_metadata.setMetadata(t.metadata),t._onWireWithMetadata(e)}),t._debug("verifying existing torrent data"),t._fileModtimes&&t._store===FSChunkStore?t.getFileModtimes(function(e,r){if(e)return t._destroy(e);var n=t.files.map(function(e,n){return r[n]===t._fileModtimes[n]}).every(function(e){return e});if(n){for(var o=0;o<t.pieces.length;o++)t._markVerified(o);t._onStore()}else t._verifyPieces()}):t._verifyPieces(),t.emit("metadata")}},Torrent.prototype.getFileModtimes=function(e){var t=this,r=[];parallelLimit(t.files.map(function(e,n){return function(o){fs.stat(path.join(t.path,e.path),function(e,t){return e&&"ENOENT"!==e.code?o(e):(r[n]=t&&t.mtime.getTime(),void o(null))})}}),FILESYSTEM_CONCURRENCY,function(n){t._debug("done getting file modtimes"),e(n,r)})},Torrent.prototype._verifyPieces=function(){var e=this;parallelLimit(e.pieces.map(function(t,r){return function(t){return e.destroyed?t(new Error("torrent is destroyed")):void e.store.get(r,function(n,o){return n?t(null):void sha1(o,function(n){if(n===e._hashes[r]){if(!e.pieces[r])return;e._debug("piece verified %s",r),e._markVerified(r)}else e._debug("piece invalid %s",r);t(null)})})}}),FILESYSTEM_CONCURRENCY,function(t){return t?e._destroy(t):(e._debug("done verifying"),void e._onStore())})},Torrent.prototype._markVerified=function(e){this.pieces[e]=null,this._reservations[e]=null,this.bitfield.set(e,!0)},Torrent.prototype._onStore=function(){var e=this;e.destroyed||(e._debug("on store"),0!==e.pieces.length&&e.select(0,e.pieces.length-1,!1),e.ready=!0,e.emit("ready"),e._checkDone(),e._updateSelections())},Torrent.prototype.destroy=function(e){var t=this;t._destroy(null,e)},Torrent.prototype._destroy=function(e,t){var r=this;if(!r.destroyed){r.destroyed=!0,r._debug("destroy"),r.client._remove(r),clearInterval(r._rechokeIntervalId),r._xsRequests.forEach(function(e){e.abort()}),r._rarityMap&&r._rarityMap.destroy();for(var n in r._peers)r.removePeer(n);r.files.forEach(function(e){e instanceof File&&e._destroy()});var o=r._servers.map(function(e){return function(t){e.destroy(t)}});r.discovery&&o.push(function(e){r.discovery.destroy(e)}),r.store&&o.push(function(e){r.store.close(e)}),parallel(o,t),e&&(0===r.listenerCount("error")?r.client.emit("error",e):r.emit("error",e)),r.emit("close"),r.client=null,r.files=[],r.discovery=null,r.store=null,r._rarityMap=null,r._peers=null,r._servers=null,r._xsRequests=null}},Torrent.prototype.addPeer=function(e){var t=this;if(t.destroyed)throw new Error("torrent is destroyed");if(!t.infoHash)throw new Error("addPeer() must not be called before the `infoHash` event");if(t.client.blocked){var r;if("string"==typeof e){var n;try{n=addrToIPPort(e)}catch(r){return t._debug("ignoring peer: invalid %s",e),t.emit("invalidPeer",e),!1}r=n[0]}else"string"==typeof e.remoteAddress&&(r=e.remoteAddress);if(r&&t.client.blocked.contains(r))return t._debug("ignoring peer: blocked %s",e),"string"!=typeof e&&e.destroy(),t.emit("blockedPeer",e),!1}var o=!!t._addPeer(e);return o?t.emit("peer",e):t.emit("invalidPeer",e),o},Torrent.prototype._addPeer=function(e){var t=this;if(t.destroyed)return t._debug("ignoring peer: torrent is destroyed"),"string"!=typeof e&&e.destroy(),null;if("string"==typeof e&&!t._validAddr(e))return t._debug("ignoring peer: invalid %s",e),null;var r=e&&e.id||e;if(t._peers[r])return t._debug("ignoring peer: duplicate (%s)",r),"string"!=typeof e&&e.destroy(),null;if(t.paused)return t._debug("ignoring peer: torrent is paused"),"string"!=typeof e&&e.destroy(),null;t._debug("add peer %s",r);var n;return n="string"==typeof e?Peer.createTCPOutgoingPeer(e,t):Peer.createWebRTCPeer(e,t),t._peers[n.id]=n,t._peersLength+=1,"string"==typeof e&&(t._queue.push(n),t._drain()),n},Torrent.prototype.addWebSeed=function(e){if(this.destroyed)throw new Error("torrent is destroyed");if(!/^https?:\/\/.+/.test(e))return this._debug("ignoring invalid web seed %s",e),void this.emit("invalidPeer",e);if(this._peers[e])return this._debug("ignoring duplicate web seed %s",e),void this.emit("invalidPeer",e);this._debug("add web seed %s",e);var t=Peer.createWebSeedPeer(e,this);this._peers[t.id]=t,this._peersLength+=1,this.emit("peer",e)},Torrent.prototype._addIncomingPeer=function(e){var t=this;return t.destroyed?e.destroy(new Error("torrent is destroyed")):t.paused?e.destroy(new Error("torrent is paused")):(this._debug("add incoming peer %s",e.id),t._peers[e.id]=e,void(t._peersLength+=1))},Torrent.prototype.removePeer=function(e){var t=this,r=e&&e.id||e;e=t._peers[r],e&&(this._debug("removePeer %s",r),delete t._peers[r],t._peersLength-=1,e.destroy(),t._drain())},Torrent.prototype.select=function(e,t,r,n){var o=this;if(o.destroyed)throw new Error("torrent is destroyed");if(e<0||t<e||o.pieces.length<=t)throw new Error("invalid selection ",e,":",t);r=Number(r)||0,o._debug("select %s-%s (priority %s)",e,t,r),o._selections.push({from:e,to:t,offset:0,priority:r,notify:n||noop}),o._selections.sort(function(e,t){return t.priority-e.priority}),o._updateSelections()},Torrent.prototype.deselect=function(e,t,r){var n=this;if(n.destroyed)throw new Error("torrent is destroyed");r=Number(r)||0,n._debug("deselect %s-%s (priority %s)",e,t,r);for(var o=0;o<n._selections.length;++o){var i=n._selections[o];if(i.from===e&&i.to===t&&i.priority===r){n._selections.splice(o--,1);break}}n._updateSelections()},Torrent.prototype.critical=function(e,t){var r=this;if(r.destroyed)throw new Error("torrent is destroyed");r._debug("critical %s-%s",e,t);for(var n=e;n<=t;++n)r._critical[n]=!0;r._updateSelections()},Torrent.prototype._onWire=function(e,t){var r=this;if(r._debug("got wire %s (%s)",e._debugId,t||"Unknown"),e.on("download",function(e){r.destroyed||(r.received+=e,r._downloadSpeed(e),r.client._downloadSpeed(e),r.emit("download",e),r.client.emit("download",e))}),e.on("upload",function(e){r.destroyed||(r.uploaded+=e,r._uploadSpeed(e),r.client._uploadSpeed(e),r.emit("upload",e),r.client.emit("upload",e))}),r.wires.push(e),t){var n=addrToIPPort(t);e.remoteAddress=n[0],e.remotePort=n[1]}r.client.dht&&r.client.dht.listening&&e.on("port",function(n){if(!r.destroyed&&!r.client.dht.destroyed){if(!e.remoteAddress)return r._debug("ignoring PORT from peer with no address");if(0===n||n>65536)return r._debug("ignoring invalid PORT from peer");r._debug("port: %s (from %s)",n,t),r.client.dht.addNode({host:e.remoteAddress,port:n})}}),e.on("timeout",function(){r._debug("wire timeout (%s)",t),e.destroy()}),e.setTimeout(PIECE_TIMEOUT,!0),e.setKeepAlive(!0),e.use(utMetadata(r.metadata)),e.ut_metadata.on("warning",function(e){r._debug("ut_metadata warning: %s",e.message)}),r.metadata||(e.ut_metadata.on("metadata",function(e){r._debug("got metadata via ut_metadata"),r._onMetadata(e)}),e.ut_metadata.fetch()),"function"!=typeof utPex||r.private||(e.use(utPex()),e.ut_pex.on("peer",function(e){r.done||(r._debug("ut_pex: got peer: %s (from %s)",e,t),r.addPeer(e))}),e.ut_pex.on("dropped",function(e){var n=r._peers[e];n&&!n.connected&&(r._debug("ut_pex: dropped peer: %s (from %s)",e,t),r.removePeer(e))}),e.once("close",function(){e.ut_pex.reset()})),r.emit("wire",e,t),r.metadata&&process.nextTick(function(){r._onWireWithMetadata(e)})},Torrent.prototype._onWireWithMetadata=function(e){function t(){n.destroyed||e.destroyed||(n._numQueued>2*(n._numConns-n.numPeers)&&e.amInterested?e.destroy():(o=setTimeout(t,CHOKE_TIMEOUT),o.unref&&o.unref()))}function r(){if(e.peerPieces.length===n.pieces.length){for(;i<n.pieces.length;++i)if(!e.peerPieces.get(i))return;e.isSeeder=!0,e.choke()}}var n=this,o=null,i=0;e.on("bitfield",function(){r(),n._update()}),e.on("have",function(){r(),n._update()}),e.once("interested",function(){e.unchoke()}),e.once("close",function(){clearTimeout(o)}),e.on("choke",function(){clearTimeout(o),o=setTimeout(t,CHOKE_TIMEOUT),o.unref&&o.unref()}),e.on("unchoke",function(){clearTimeout(o),n._update()}),e.on("request",function(t,r,o,i){return o>MAX_BLOCK_LENGTH?e.destroy():void(n.pieces[t]||n.store.get(t,{offset:r,length:o},i))}),e.bitfield(n.bitfield),e.interested(),e.peerExtensions.dht&&n.client.dht&&n.client.dht.listening&&e.port(n.client.dht.address().port),o=setTimeout(t,CHOKE_TIMEOUT),o.unref&&o.unref(),e.isSeeder=!1,r()},Torrent.prototype._updateSelections=function(){var e=this;e.ready&&!e.destroyed&&(process.nextTick(function(){e._gcSelections()}),e._updateInterest(),e._update())},Torrent.prototype._gcSelections=function(){for(var e=this,t=0;t<e._selections.length;t++){for(var r=e._selections[t],n=r.offset;e.bitfield.get(r.from+r.offset)&&r.from+r.offset<r.to;)r.offset++;n!==r.offset&&r.notify(),r.to===r.from+r.offset&&e.bitfield.get(r.from+r.offset)&&(e._selections.splice(t--,1),r.notify(),e._updateInterest())}e._selections.length||e.emit("idle")},Torrent.prototype._updateInterest=function(){var e=this,t=e._amInterested;e._amInterested=!!e._selections.length,e.wires.forEach(function(t){e._amInterested?t.interested():t.uninterested()}),t!==e._amInterested&&(e._amInterested?e.emit("interested"):e.emit("uninterested"))},Torrent.prototype._update=function(){var e=this;if(!e.destroyed)for(var t,r=randomIterate(e.wires);t=r();)e._updateWire(t)},Torrent.prototype._updateWire=function(e){function t(t,r,n,o){return function(i){return i>=t&&i<=r&&!(i in n)&&e.peerPieces.get(i)&&(!o||o(i))}}function r(){if(!e.requests.length)for(var r=s._selections.length;r--;){var n,o=s._selections[r];if("rarest"===s.strategy)for(var i=o.from+o.offset,d=o.to,a=d-i+1,u={},c=0,p=t(i,d,u);c<a&&(n=s._rarityMap.getRarestPiece(p),!(n<0));){if(s._request(e,n,!1))return;u[n]=!0,c+=1}else for(n=o.to;n>=o.from+o.offset;--n)if(e.peerPieces.get(n)&&s._request(e,n,!1))return}}function n(){var t=e.downloadSpeed()||1;if(t>SPEED_THRESHOLD)return function(){return!0};var r=Math.max(1,e.requests.length)*Piece.BLOCK_LENGTH/t,n=10,o=0;return function(e){if(!n||s.bitfield.get(e))return!0;for(var i=s.pieces[e].missing;o<s.wires.length;o++){var d=s.wires[o],a=d.downloadSpeed();if(!(a<SPEED_THRESHOLD)&&!(a<=t)&&d.peerPieces.get(e)&&!((i-=a*r)>0))return n--,!1}return!0}}function o(e){for(var t=e,r=e;r<s._selections.length&&s._selections[r].priority;r++)t=r;var n=s._selections[e];s._selections[e]=s._selections[t],s._selections[t]=n}function i(r){if(e.requests.length>=a)return!0;for(var i=n(),d=0;d<s._selections.length;d++){var u,c=s._selections[d];if("rarest"===s.strategy)for(var p=c.from+c.offset,l=c.to,f=l-p+1,h={},_=0,g=t(p,l,h,i);_<f&&(u=s._rarityMap.getRarestPiece(g),!(u<0));){for(;s._request(e,u,s._critical[u]||r););if(!(e.requests.length<a))return c.priority&&o(d),!0;h[u]=!0,_++}else for(u=c.from+c.offset;u<=c.to;u++)if(e.peerPieces.get(u)&&i(u)){for(;s._request(e,u,s._critical[u]||r););if(!(e.requests.length<a))return c.priority&&o(d),!0}}return!1}var s=this;if(!e.peerChoking){if(!e.downloaded)return r();var d=getBlockPipelineLength(e,PIPELINE_MIN_DURATION);if(!(e.requests.length>=d)){var a=getBlockPipelineLength(e,PIPELINE_MAX_DURATION);i(!1)||i(!0)}}},Torrent.prototype._rechoke=function(){function e(e,t){return e.downloadSpeed!==t.downloadSpeed?t.downloadSpeed-e.downloadSpeed:e.uploadSpeed!==t.uploadSpeed?t.uploadSpeed-e.uploadSpeed:e.wire.amChoking!==t.wire.amChoking?e.wire.amChoking?1:-1:e.salt-t.salt}var t=this;if(t.ready){t._rechokeOptimisticTime>0?t._rechokeOptimisticTime-=1:t._rechokeOptimisticWire=null;var r=[];t.wires.forEach(function(e){e.isSeeder||e===t._rechokeOptimisticWire||r.push({wire:e,downloadSpeed:e.downloadSpeed(),uploadSpeed:e.uploadSpeed(),salt:Math.random(),isChoked:!0})}),r.sort(e);for(var n=0,o=0;o<r.length&&n<t._rechokeNumSlots;++o)r[o].isChoked=!1,r[o].wire.peerInterested&&(n+=1);if(!t._rechokeOptimisticWire&&o<r.length&&t._rechokeNumSlots){var i=r.slice(o).filter(function(e){return e.wire.peerInterested}),s=i[randomInt(i.length)];s&&(s.isChoked=!1,t._rechokeOptimisticWire=s.wire,t._rechokeOptimisticTime=RECHOKE_OPTIMISTIC_DURATION)}r.forEach(function(e){e.wire.amChoking!==e.isChoked&&(e.isChoked?e.wire.choke():e.wire.unchoke())})}},Torrent.prototype._hotswap=function(e,t){var r=this,n=e.downloadSpeed();if(n<Piece.BLOCK_LENGTH)return!1;if(!r._reservations[t])return!1;var o=r._reservations[t];if(!o)return!1;var i,s,d=1/0;for(s=0;s<o.length;s++){var a=o[s];if(a&&a!==e){var u=a.downloadSpeed();u>=SPEED_THRESHOLD||2*u>n||u>d||(i=a,d=u)}}if(!i)return!1;for(s=0;s<o.length;s++)o[s]===i&&(o[s]=null);for(s=0;s<i.requests.length;s++){var c=i.requests[s];c.piece===t&&r.pieces[t].cancel(c.offset/Piece.BLOCK_LENGTH|0)}return r.emit("hotswap",i,e,t),!0},Torrent.prototype._request=function(e,t,r){function n(){process.nextTick(function(){o._update()})}var o=this,i=e.requests.length,s="webSeed"===e.type;if(o.bitfield.get(t))return!1;var d=s?Math.min(getPiecePipelineLength(e,PIPELINE_MAX_DURATION,o.pieceLength),o.maxWebConns):getBlockPipelineLength(e,PIPELINE_MAX_DURATION);if(i>=d)return!1;var a=o.pieces[t],u=s?a.reserveRemaining():a.reserve();if(u===-1&&r&&o._hotswap(e,t)&&(u=s?a.reserveRemaining():a.reserve()),u===-1)return!1;var c=o._reservations[t];c||(c=o._reservations[t]=[]);var p=c.indexOf(null);p===-1&&(p=c.length),c[p]=e;var l=a.chunkOffset(u),f=s?a.chunkLengthRemaining(u):a.chunkLength(u);return e.request(t,l,f,function r(i,d){if(!o.ready)return o.once("ready",function(){r(i,d)});if(c[p]===e&&(c[p]=null),a!==o.pieces[t])return n();if(i)return o._debug("error getting piece %s (offset: %s length: %s) from %s: %s",t,l,f,e.remoteAddress+":"+e.remotePort,i.message),s?a.cancelRemaining(u):a.cancel(u),void n();if(o._debug("got piece %s (offset: %s length: %s) from %s",t,l,f,e.remoteAddress+":"+e.remotePort),!a.set(u,d,e))return n();var h=a.flush();sha1(h,function(e){if(e===o._hashes[t]){if(!o.pieces[t])return;o._debug("piece verified %s",t),o.pieces[t]=null,o._reservations[t]=null,o.bitfield.set(t,!0),o.store.put(t,h),o.wires.forEach(function(e){e.have(t)}),o._checkDone()}else o.pieces[t]=new Piece(a.length),o.emit("warning",new Error("Piece "+t+" failed verification"));n()})}),!0},Torrent.prototype._checkDone=function(){var e=this;if(!e.destroyed){e.files.forEach(function(t){if(!t.done){for(var r=t._startPiece;r<=t._endPiece;++r)if(!e.bitfield.get(r))return;t.done=!0,t.emit("done"),e._debug("file done: "+t.name)}});for(var t=!0,r=0;r<e._selections.length;r++){for(var n=e._selections[r],o=n.from;o<=n.to;o++)if(!e.bitfield.get(o)){t=!1;break}if(!t)break}!e.done&&t&&(e.done=!0,e._debug("torrent done: "+e.infoHash),e.discovery.tracker&&e.discovery.tracker.complete(),e.emit("done")),e._gcSelections()}},Torrent.prototype.load=function(e,t){var r=this;if(r.destroyed)throw new Error("torrent is destroyed");if(!r.ready)return r.once("ready",function(){r.load(e,t)});Array.isArray(e)||(e=[e]),t||(t=noop);var n=new MultiStream(e),o=new ChunkStoreWriteStream(r.store,r.pieceLength);pump(n,o,function(e){return e?t(e):(r.pieces.forEach(function(e,t){r.pieces[t]=null,r._reservations[t]=null,r.bitfield.set(t,!0)}),r._checkDone(),void t(null))})},Torrent.prototype.createServer=function(e){if("function"!=typeof Server)throw new Error("node.js-only method");if(this.destroyed)throw new Error("torrent is destroyed");var t=new Server(this,e);return this._servers.push(t),t},Torrent.prototype.pause=function(){this.destroyed||(this._debug("pause"),this.paused=!0)},Torrent.prototype.resume=function(){this.destroyed||(this._debug("resume"),this.paused=!1,this._drain())},Torrent.prototype._debug=function(){var e=[].slice.call(arguments);e[0]="["+this._debugId+"] "+e[0],debug.apply(null,e)},Torrent.prototype._drain=function(){var e=this;if(this._debug("_drain numConns %s maxConns %s",e._numConns,e.client.maxConns),!("function"!=typeof net.connect||e.destroyed||e.paused||e._numConns>=e.client.maxConns)){this._debug("drain (%s queued, %s/%s peers)",e._numQueued,e.numPeers,e.client.maxConns);var t=e._queue.shift();if(t){this._debug("tcp connect attempt to %s",t.addr);var r=addrToIPPort(t.addr),n={host:r[0],port:r[1]},o=t.conn=net.connect(n);o.once("connect",function(){t.onConnect()}),o.once("error",function(e){t.destroy(e)}),t.startConnectTimeout(),o.on("close",function(){if(!e.destroyed){if(t.retries>=RECONNECT_WAIT.length)return void e._debug("conn %s closed: will not re-add (max %s attempts)",t.addr,RECONNECT_WAIT.length);var r=RECONNECT_WAIT[t.retries];e._debug("conn %s closed: will re-add to queue in %sms (attempt %s)",t.addr,r,t.retries+1);var n=setTimeout(function(){var r=e._addPeer(t.addr);r&&(r.retries=t.retries+1)},r);n.unref&&n.unref()}})}}},Torrent.prototype._validAddr=function(e){var t;try{t=addrToIPPort(e)}catch(e){return!1}var r=t[0],n=t[1];return n>0&&n<65535&&!("127.0.0.1"===r&&n===this.client.torrentPort)};