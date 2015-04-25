/* ***************************************************************************************

TODO:

Allow for a toggle between visualizations and top-down map.

Don't have all tracks restart at once every second tick update for GPS time offset fixes, space them out a bit so it's not as obvious -- schedule them every 100mx

iPhone crashes! Clear buffers? -- POSSIBLY FIXED: see _playTracks, it involved looping through by distance.

facebook & twitter default tweets (with GPS location? Then we need a 'go to my location' button too )
social share graphics

SECURITY on POST: ensure data integrity? Check on edit to make sure edit id is not a track and is a person.





credits page:
Richard bio -- link to 3232
Stefon bio -- link to bionik
Volunteer thanks
Note: save as a home page app for full-screen!
Issues: Has to be outside for GPS to work properly! Give GPS 60 seconds to warm up after starting for most accurate location.

stress-test and load-test connections.

start pre-loading GPS tracks, but don't play until button press.




NICE TO HAVE
Open Source / GitHub
fade in markers / visualization dots when loaded
visualizations: bump in time to the music



*************************************************************************************** */



!function ($, window) {

	"use strict";

//----------------------------------------------------------------------
// Class Definition
//----------------------------------------------------------------------
	
	var view = function (element, options) {
		this.$window 			= $(window);
		this.$body 				= $('body');
		this.$document 			= $(document);	
		this.options 			= options;

		this.vw 				= this.getViewport()[0]; // viewport width
		this.vh 				= this.getViewport()[1]; // viewport height

		this.TABLET_LANDSCAPE 	= 1024;
		this.TABLET_PORTRAIT 	= 768;
		this.MOBILE_LANDSCAPE 	= 560;
		this.MOBILE_PORTRAIT 	= 320;

		this.isMobile 			= this.vw <= this.TABLET_LANDSCAPE && !!('ontouchstart' in window);
		this.isLoaded 			= false;




		// trap console log errors in IE
		if (typeof console == "undefined") { window.console = { log: function () {} }; }



		if (typeof google !== 'undefined') {

			this.whirlymap 				= true;

			var url = window.location.href;
			this.url = url.substring(0, url.lastIndexOf(':'))


			this.points 				= [];
            this.pointsByDistance       = [];
			this.new_points 			= [];
            this.resetPoints = true;
            this.isTimeAnchorReset      = false;

			this.meters_to_degrees 		= .000007871; // for 45ºN, multiplier = 1m
			//this.meters_to_degrees 		= .00001; // for 45ºN, multiplier = 1m


			this.MAXIMUM_TRACKS_PLAYABLE= this.isMobile ? 6 : 12;
			this.MAXIMUM_POINTS_VISIBLE = this.isMobile ? 50 : 150;
			this.medleyId 				= 1;
            // this.gps_delta              = 0;
			this.universal_time 		= new Date().getTime() / 1000;
			this.medley_offset 			= 0;
			this.medley_length 			= 3 * 60; // medley is three minutes long

			this.audio 					= [];
			this.audio_buffers 			= [];

            this.test_play_array        = [];
            this.test_stop_array        = [];

            this.soundboard             = [];
            this.stingers               = [];

			this.isGetPointsReady 		= false;

			this.sockets 				= [];


            this.useGPS                 = true; // set this to false to turn off all GPS processing and default to initial_latlng
            // this.useGPS                 = false; // set this to false to turn off all GPS processing and default to initial_latlng
            this.initial_latlng         = [44.978584, -93.256087];

            // check location hash for a search parameter.
            var ls = location.hash;

            if (ls) {
                ls = ls.substring(1, ls.length);
                if (ls.indexOf('GPS:') > 0) {
                    var coords = ls.substring(ls.indexOf('GPS:') + 4, ls.indexOf('#'));
                    coords = coords.split(',');
                    if (coords[0] != 'undefined') {
                        this.useGPS = false;
                        this.initial_latlng = coords;
                    }
                }
            }


			this.lat 					= this.initial_latlng[0];
			this.lng 					= this.initial_latlng[1];
			this.radius 				= 20; // distance cutoff in meters for playable tracks

			this.geolocationSpeed 		= 2000; // in ms

			this.map_container			= $('#map');
			this.$arrow 				= $('#arrow');
			this.$cube 					= $('#cube');

			this.radiusCircle			= 0; // the accuracy radius as drawn on the map
			// this.currentDot				= 0; // the current translated position
			this.compass_needle  		= 0;
			this.compass_needlecircle  	= 0;
			this.DEFAULT_ACCURACY 		= .1;
			this.DEFAULT_RADIUS 		= 20;

			this.current_rotation 		= 0;
			this.current_pitch 			= 0;

			this.visualizations 		= [];
			this.trackId 				= 1;

			this.latlngbounds			= new google.maps.LatLngBounds(); // This lets us zoom the map to fit our markers

			google.maps.event.addDomListener(window, 'load', $.proxy(this.init, this));


			//if (this.isMobile) console.log = this.log;


		} else {
			(console.log('GOOGLE IS DOWN'));
		}
	}

	view.prototype = {

		constructor: view,



//----------------------------------------------------------------------
// Private Functions
//----------------------------------------------------------------------






/*  ################################################################################################
	INITIALIZATION
	################################################################################################
*/


		init: function () {
			var self = this;


            $(function() {
                FastClick.attach(document.body);
            });

			$('#loading').height(this.vh);

			if (!(location.href.indexOf('#debugger') > 0)) {

				$('#loading #init').hide();

				var splash = $('#loading #splash')
				var splashimg = $('<img src="/img/favicon.png">')
				splash.html(splashimg);
				splash.css({ 'margin-top': this.vh/2 - 150 });
				splash.append('<h3>#YouAreHear: the interactive 3D soundtrack of Northern Spark. Bring headphones. <br><span>@BionikMusic @richard_the_red #nspk15 @Northern_Spark</span></h3>')


				$('#loading #splash').show();

			} else {




				$.get('/api/v1/albums/1/list', function(album) {

					self.$visualizations 	= $('#visualizations');
					self.album = album[0];

					self._initListeners();
					self._initMap();
					self._initAudio();
					self.resize();
					self._initSockets();



                    // preload soundboard
                    self.soundboard[0] = '/albums/Northern Spark/soundboard/1-COWBELL.mp3';
                    self.soundboard[1] = '/albums/Northern Spark/soundboard/2-CLAP.mp3';
                    self.soundboard[2] = '/albums/Northern Spark/soundboard/3-WOW.mp3';
                    self.soundboard[3] = '/albums/Northern Spark/soundboard/4-CYMBAL.mp3';
                    self.soundboard[4] = '/albums/Northern Spark/soundboard/5-SFX.mp3';
                    self.soundboard[5] = '/albums/Northern Spark/soundboard/6-DJ SIREN.mp3';

                    for (var i in self.soundboard) {
                        // console.log(self.soundboard[i])
                        self.oneOff({ url: self.soundboard[i], preloadOnly: true });
                        var a = $('<a data-soundid="'+ i +'">'+ i +'</div>').click($.proxy(handleSoundboard, self));
                        $('#soundboard').append(a);
                    }



                    // preload soundboard
                    self.stingers[0] = '/albums/Northern Spark/stingers/01.mp3';
                    self.stingers[1] = '/albums/Northern Spark/stingers/02.mp3';

                    for (var i in self.stingers) {
                        self.oneOff({ url: self.stingers[i], preloadOnly: true });
                    }

					// when stinger is loaded, finish up the load when stinger is preloaded.
					self.oneOff({ url: '/albums/Northern Spark/stingers/01.mp3', callback: function() { self.doFinalLoad(); }, preloadOnly: true });

				});
			}


		},



		_playBuffer: function(stinger, lat, lng) {
			// stop it first
            // console.log('_playBuffer', stinger, lat, lng)
			if (stinger) if (stinger.source) if (stinger.isPlaying) if (stinger.source.noteOff) stinger.source.noteOff(0); else stinger.source.stop(0);
			
            lat = lat || this.lat;
            lng = lng || this.lng;

            // create a new disposable one-off
			stinger.source = this.context.createBufferSource(); 
			stinger.source.buffer = stinger.buffer;



            stinger.panner = this.context.createPanner();
            stinger.panner.refDistance = .00008;
            stinger.panner.rolloffFactor = 10;
            stinger.panner.setPosition(lat, lng, 0);
            stinger.panner.connect(this.context.destination);
            stinger.source.connect(stinger.panner);
       


			stinger.isPlaying = true;
			if (stinger.source.noteOn) stinger.source.noteOn(0); else stinger.source.start(0);
			// TODO: make isPlaying go off after buffer.duration

			return stinger;
		},



		oneOff: function(arg, lat, lng) {
			var self = this;
            //console.log('oneOff ', arg.url, lat, lng)
			if (self.audio_buffers[arg.url]) {
				// we've played this one before, we've stored a buffer
				if (!arg.preloadOnly) self.audio_buffers[arg.url] = self._playBuffer(self.audio_buffers[arg.url], lat, lng);
				if (arg.callback) if (typeof arg.callback == 'function') arg.callback();

			} else {
				// we haven't played this one yet, have to load it first.
                self.audio_buffers[arg.url] = { id:123, track_url: arg.url };
				var stingerLoader = new AudioLoader (
					self.context,
					self.audio_buffers[arg.url],
					function (buffer, pointId) {
						var tmpaud = {};
						tmpaud.buffer = buffer;
						self.audio_buffers[arg.url] = tmpaud;

						if (!arg.preloadOnly) self.audio_buffers[arg.url] = self._playBuffer(self.audio_buffers[arg.url], lat, lng);
						if (typeof arg.callback == 'function') arg.callback();
					}
				);
				stingerLoader.load();
			}

		},





		_initListeners: function () {
			this.$window.on('resize', $.proxy(handleResize, this));
			this.$window.on('mousemove', $.proxy(handleMousemove, this));
			this.$window.on('mousedown', $.proxy(handleMouseDown, this));
			this.$window.on('keydown', $.proxy(handleKeyDown, this));            
			window.addEventListener('deviceorientation', $.proxy(this._orientationChange, this), false);
		},




		doFinalLoad: function () {
			this.resize(); // make sure everything lines up nice
			this.finalLoad = true;

			var self = this;

			$('#loading button').click(function() { self.doFinalFinalLoad(); });
			$('#loading #init').hide();

			var start = $('#loading #splash button');
			start.css({ 'margin-top': this.vh / 2 - start.height()/2 });

			$('#loading #splash').show();


		},

		doFinalFinalLoad: function () {
			var self = this;

			this.$arrow.fadeIn();

            // initial stinger
			self.oneOff({url: '/albums/Northern Spark/stingers/01.mp3', callback: function() {
				self._secondTick();
				// set off tick timers
				setInterval(function() {
					self._secondTick();
				}, 1000);
                setInterval(function() {
                    self._momentTick();
                }, 3000);
                setInterval(function() {
                    self._minuteTick();
                }, 10000);

			} });

			

			self.geoLocate();

			$('#loading').remove();
			this.isLoaded = true; // let the app know things are done
		},










/*  ################################################################################################
	WEBSOCKETS
	################################################################################################
*/


		_initSockets: function() {
			var self = this;
			this.socket = io.connect(this.url + ':3001');
            this.socket.on('error', function() { console.error(arguments) });
            this.socket.on('message', function(data) {
                console.log('message response:', data);
                self.setTimeAnchor(data.server_time);
            });
			this.socket.on('pong', function(data) {
				if (self.points[data.id] && data.id != self.point.id) {
                    console.log('pong', data)
                    self.setTimeAnchor(data.server_time);
                    self.points[data.id].marker.setPosition( new google.maps.LatLng (data.lat, data.lng) );
                }
			});
            this.socket.on('song', function(data) {
                self.oneOff({ url: data.url }, data.lat, data.lng);
            });
		},


        _addSocket: function(socketid) {
            //console.log('_addSocket', socketid);
            this.sockets[socketid] = socketid;
            this.socket.emit('join', socketid);
        },


        _removeSocket: function(socketid) {
            // console.log('_removeSocket', socketid);
            if (this.sockets[socketid]) delete this.sockets[socketid];
        },


		_uploadPositionSuccess: function(result) {
			var self = this;
            var point = result;

			self.point = point;
            self.point.name = self.point.id;

            // play my own emissions!
            if (self.point) if ($.inArray(self.point.id, self.sockets) < 0) { self._addSocket(self.point.id); }
			
		},

		_uploadPosition: function () {
			var self = this;
			var posturl = '/api/v1/points';

			if (this.socket) {

				if (this.point) {
					// update

					var upd_posturl = posturl +  '/' + this.point.id;

					var point = {
						id: this.point.id,
						lat: this.lat,
						lng: this.lng,
						latlng: {lat:this.lat, lng: this.lng},
						accuracy: this.accuracyInMeters,
						name: this.point.id
					}

                    if (this.point.date) {
                        var d = new Date(this.point.date);
                        d.setSeconds(d.getSeconds() + 1)
                        if (d.getSeconds() >= 60) {
                            d.setSeconds(0); d.setMinutes(d.getMinutes() + 1);
                        }

                        point.date = d
                    }

					$.ajax({
						type: 'PUT',
						url: upd_posturl,
						data: point,
						success: $.proxy(self._uploadPositionSuccess, self),
						error: function() { self._addMyPoint(posturl); /* if it 404s try just updating the existing point instead, it may have gotten deleted */ }
					});

				} else {
					// add
					this._addMyPoint(posturl);

				}
			}

		},


		_addMyPoint: function(posturl) {
			// add
			var self = this;	
			var point = {
				trackId: this.trackId,
				lat: this.lat,
				lng: this.lng,
				latlng: {lat:this.lat, lng: this.lng},
				accuracy: this.accuracyInMeters,
				name: this.point ? this.point.id : 'person'
			};
			$.post(posturl, point, $.proxy(self._uploadPositionSuccess, self));

		},







/*  ################################################################################################
	MAPPING
	################################################################################################
*/
		_initMap: function () {

			var self = this;

			var featureOpts = [
				{ stylers: [] },
				{ featureType: 'landscape', "elementType": "geometry.fill", stylers: [ { color: '#000000' } ] },
				{ featureType: 'landscape.man_made', "elementType": "geometry.fill", stylers: [ { color: '#000000' } ] },
				{ featureType: 'landscape.natural', "elementType": "geometry.fill", stylers: [ { color: '#263813' } ] },
				//{ featureType: 'poi', "elementType": "geometry.fill", stylers: [ { color: '#263813' } ] },
				{ featureType: 'poi', stylers: [ { visibility: 'off' } ] },
				{ featureType: 'road', "elementType": "geometry.fill", stylers: [ { color: '#000000' } ] },
				{ featureType: 'road', "elementType": "geometry.stroke", stylers: [ { color: '#735c00' },{ weight: .5 } ] },
				{ featureType: 'transit', "elementType": "geometry.fill", stylers: [ { color: '#2b2200' } ] },
				{ elementType: 'labels', stylers: [ { color: '#735c00' }, { weight: .1 } ] },
				{ featureType: 'water', stylers: [ { color: '#081d33' } ] }
			];


			var mapOptions = {
				draggable: false,
				backgroundColor: '#000000',
				geodesic: true,
				center: new google.maps.LatLng(this.initial_latlng[0],this.initial_latlng[1]),
				mapTypeControl: false,
				panControl: false,
				scaleControl: true,
				zoomControl: true,
				zoomControlOptions: {
					style: google.maps.ZoomControlStyle.SMALL,
					position: (this.vw > this.vh ? google.maps.ControlPosition.LEFT_BOTTOM : google.maps.ControlPosition.RIGHT_TOP)
				},
				streetViewControl: false,
				zoom: 22

			};
			
			this.map = new google.maps.Map(document.getElementById('map'), mapOptions);

			var styledMapOptions = { name: 'Simple' };
			var customMapType = new google.maps.StyledMapType(featureOpts, styledMapOptions);
			this.map.mapTypes.set('custom_style', customMapType);
			this.map.setMapTypeId('custom_style');

			google.maps.event.addListener(this.map, 'click', $.proxy(!self.isMobile ? handleMapClick : handleMobileMapClick, this));
			

		},


		_drawRadius: function () {
			//console.log('_drawRadius: ' + this.accuracyInMeters)
			var latlng = new google.maps.LatLng(this.lat, this.lng);
			var accuracy = this.accuracyInMeters || this.DEFAULT_RADIUS;
			if (!this.isMobile) accuracy = this.DEFAULT_RADIUS;

			if (this.radiusCircle != 0) this.radiusCircle.setMap(null);

			var circleOptions = {
				strokeColor: this.options.positionRadiusColor,
				strokeOpacity: .5,
				strokeWeight: 2,
				fillColor: this.options.positionRadiusColor,
				fillOpacity: 0.1,
				center: latlng,
				radius: accuracy,
				clickable: false
			};

			this.radiusCircle = new google.maps.Circle(circleOptions);

			this.radiusCircle.setMap(this.map);

		},



		_createMarker: function (point) {
			var self = this;
			var marker = point;
			var lat = point.lat;
			var lng = point.lng;
			var glatlng = new google.maps.LatLng(point.lat,point.lng);
			this.latlngbounds.extend(glatlng);

		
		 	var rgb = self._getRGB(point);

			var marker_icon = new google.maps.Marker({
				map: self.map,
				position: glatlng,
				title: point.track_url,
				optimized: false,
				clickable: false,
				//zIndex: 3,
				icon: {
			        path: google.maps.SymbolPath.CIRCLE,
			        scale: 10,
			        fillColor: rgb,
			        fillOpacity: 1,
			        strokeOpacity: 0,
			        //strokeColor: '#ffffff',
					origin: new google.maps.Point(0,0),
					anchor: new google.maps.Point(0,0)
				}
			});

			point.marker = marker_icon;
			
		},




        _removeMarkers: function() {
            var self = this;
            for (var i in self.points) {
                var point = self.points[i];
                if (point.marker) {
                    point.marker.setMap(null);
                    delete point.marker;
                }
            }
        },








/*  ################################################################################################
	AUDIO
	################################################################################################
*/


		_initAudio: function () {
			var self = this;
			// test for webaudio api -- if this.context is not false, we have web audio API ready
			try {
				window.AudioContext = window.AudioContext||window.webkitAudioContext;
				this.context = new AudioContext();
			} catch(e) {
				console.log('Web Audio API is not supported in this browser');
			}

			if (!this.context.createGain) this.context.createGain = this.context.createGainNode;
			this.scale = 5000;
			
		},


		setLatLng: function (lat, lng) {
			if (!lat) { lat = this.lat; } else { this.lat = lat; }
			if (!lng) { lng = this.lng; } else { this.lat = lng; }

			this.context.listener.setPosition(lat, lng, 0);
		},


		_setMedleyId: function () {
			var self = this;

			var album_length = this.medley_length * self.album.medleys.length;

			// Find current medley. 
			self._setMedleyOffset();
			var medley = Math.floor((self.universal_time % album_length) / this.medley_length);

			var new_medley = self.album.medleys[medley];
			if (self.medleyId != new_medley.id) {
				self.medleyId = new_medley.id;
                self.resetPoints = true;

                // set the track id appropriate to this medley
                // var mysong = Math.floor(Math.random() * self.album.medleys[medley].songs.length);
                // var mytrack = Math.floor(Math.random() * self.album.medleys[medley].songs[mysong].tracks.length);
                // self.trackId = self.album.medleys[medley].songs[mysong].tracks[mytrack].id;
                //console.log('_setMedleyId: self.trackId:', self.trackId, self.point || 'no point id set')

				if (self.isGetPointsReady) self._getPoints();
			}

		},

		_setMedleyOffset: function () {
			this.universal_time = new Date().getTime();
            //console.log(this.time_anchor)
			if (typeof this.time_anchor != 'undefined') {
				this.universal_time += this.time_anchor;
			}
			this.universal_time /= 1000;
			this.medley_offset = (this.universal_time % (this.medley_length));
            //console.log('_setMedleyOffset', this.universal_time)
		},


        // setGPSAnchor: function(t) {
        //     this.gps_delta = t;
        // },


        setTimeAnchor: function(t) {

            if (typeof t !== 'undefined') {
                var nextTimeAnchor = t - new Date().getTime();// + this.gps_delta;


                if (typeof this.time_anchor != 'undefined') {
                    if (Math.abs(nextTimeAnchor - this.time_anchor) > 100) { // only reset if it's off by more than 1/10 of a second.
                        console.log('setTimeAnchor', nextTimeAnchor, t)
                        this.isTimeAnchorReset = true;
                        this.time_anchor = nextTimeAnchor;
                    }

                } else { // first time through, just set it.
                    console.log('setTimeAnchor 1', nextTimeAnchor, t)
                    this.time_anchor = nextTimeAnchor;
                }
            }
        },


		_play: function (point) {
			// console.log('_play', point.id)

			if (point) if (this.audio[point.id]) { // is it already playing?
				if (!this.audio[point.id].isPlaying && this.audio[point.id].source) {
					var src = this.audio[point.id].source;

					this._setMedleyOffset();
					//console.log('_playing ', Math.round(this.medley_offset), '; ', this.medleyId, ':', point.id, point.track_url, this.play_array.length)

					var starthere = this.medley_offset % src.buffer.duration;
                    try {

    					if (src.noteOn) {
    						src.noteGrainOn(this.context.currentTime, starthere,  src.buffer.duration - starthere);

    					} else {
    						src.start(0, starthere);

    					}

                        this.test_play_array[point.id] = point.id;

                        this.audio[point.id].isLoading = false;
                        this.audio[point.id].isPlaying = true;
                        //console.log('played', point.id, this.audio[point.id].isPlaying)

                    } catch (e) {
                        //console.log('caught', point.id, this.audio[point.id].isPlaying)
                    }

				} else {
                    //console.log('broken', point.id)
                }

			} else {
				// load it, then play
				this._loadTrack(point);
			}
		},

		_stop: function (point) {
            // console.log('_stop', point.id, point)
			if (point) if (this.audio[point.id]) {

				if (this.audio[point.id].isPlaying && this.audio[point.id].source) {
					if (this.audio[point.id].source && this.audio[point.id].source.noteOff) {
						this.audio[point.id].source.noteOff(0);
					} else {
						this.audio[point.id].source.stop(0);
					}
				}
				delete this.points[point.id].buffer;
				delete this.audio[point.id];
                this.test_stop_array[point.id] = point.id;
			}
		},

        _stopAll: function () {
            for (var i in this.points) {
                this._stop(this.points[i]);
            }
        },



		_loadTrack: function (point) {
            //console.log('_loadTrack', point.id)
			var self = this;
			var pointId = point.id;
			var point = this.points[point.id];

			if (!this.audio[point.id]) {
				this.audio[point.id] = {};

				this.audio[point.id].isLoading = true;

				if (!this.points[pointId].buffer) {
                    //console.log('_loadTrack: adding buffer', point.id)
					var audioLoader = new AudioLoader (
						this.context,
						point,
						$.proxy(this._audioOnLoad, this)
					);

					audioLoader.load();

				} else {
					this._bufferLoad(point.id);

				}
			}

		},

		_bufferLoad: function (pointId) {
            //console.log('_bufferLoad', pointId)
			var point = this.points[pointId];
			if (point) {
				this._createAudioBufferNode(pointId);
			} else {
				console.log('_bufferLoad: Point missing: ', pointId, point)
			}

		},

		_createAudioBufferNode: function (pointId, loop) {
			var point = this.points[pointId];
			var trackId = point.trackId;
			if (point && this.audio[pointId]) {
				this.audio[pointId].source = this.context.createBufferSource(); // this is a one-shot thing. Once stopped, can never be started again.
				this.audio[pointId].source.buffer = this.points[pointId].buffer;
                this.audio[pointId].source.loop = !loop; // if you pass in true, it will play only once
                //this.audio[pointId].source.loop = false; // if we restart everything once a second anyway, there's no need to loop.

				this.audio[pointId].panner = this.context.createPanner();
				this.audio[pointId].panner.refDistance = .00008;
				this.audio[pointId].panner.rolloffFactor = 10;
				this.audio[pointId].panner.setPosition(point.lat, point.lng, 0);
				this.audio[pointId].panner.connect(this.context.destination);
				this.audio[pointId].source.connect(this.audio[pointId].panner);

			} else {
                console.log('_createAudioBufferNode: Point missing: ', pointId)
			}

		},



		_audioOnLoad: function (buffer, pointId) {
            //console.log('_audioOnLoad', pointId)
			var point = this.points[pointId];

            if (this.audio[pointId]) this.audio[pointId].isLoading = false;

			if (point) {
				this.points[pointId].buffer = buffer;
				this._createAudioBufferNode(pointId);
                this._play(point);

			} else {
                // this may happen if the track is not finished loading before the point moves out of range
				console.log('_audioOnLoad: Point missing: ', pointId)
			}

		},





/*  ################################################################################################
	VISUALIZATIONS
	################################################################################################
*/

		// Move according to gyro!
		_drawDots: function(compass, pitch) {
			var self = this;

			var xmid = Math.round(self.vw / 2);
			var ymid = Math.round(self.vh / 4);



			var perspective = self.vmax; // 1500 is far away, 200 is close

			self.$visualizations.css({
				'perspective': perspective,
				'-webkit-perspective': perspective,
				'-moz-perspective': perspective,
				'-ms-perspective': perspective,
				'-o-perspective': perspective,
				//'transform': ''
			})


			$('.vdot').each(function(i, o) {
				var dot = $(this);

				var angle = compass + dot.data('angle') + 180; // angle of dot from center dot according to which direction we're facing
				var radians = angle * (Math.PI / 180); // converted to radians

				var distance = dot.data('distance'); // distance in meters to dot
				var op_distance = 10 - distance; // inverse distance value (10 is the default radius)

				var radius = distance * self.vw;

				var t = '';

				// center to screen center
				t += ' translateY(' + ymid + 'px) ';
				t += ' translateX(' + xmid + 'px) ';

				// push straight back in 3d space
				t += ' translate3d(' + 0 + 'px, ' + 0 + 'px, ' + (radius * Math.cos(radians)) + 'px) ';

				// push horizontally and back to where the dot actually sits.
				t += ' translate3d(' + (radius * Math.sin(radians)) + 'px, ' + 0 + 'px, ' + (radius * Math.cos(radians)) + 'px) ';

				//t += ' rotateY(-'+angle+'deg) ';


				dot.css({
					'-webkit-transform': t,
					'-moz-transform': t,
					'-o-transform': t,
					'transform': t
				});

				//self.$visualizations.css({ 'top': (pitch * (ymid / 90)) })

			});
		},


		_placeVisualizations: function (compass, pitch, clearAll) {
			var self = this;
			var vis_ids = [];

			//console.log('_placeVisualizations', self.MAXIMUM_TRACKS_PLAYABLE)
			if (clearAll) this.$visualizations.html('');

			// loop through radius points and draw visuals
			var point_counter = 0;
			for (var i in self.points) {

		 		var point = self.points[i];

                var pointIsMe = true;
                if (self.point) { // if we have an internalized point, make sure it matches.
                    if (self.point.id != point.id) pointIsMe = false;
                } else {
                    pointIsMe = false;
                }
		 		if (point_counter++ < self.MAXIMUM_POINTS_VISIBLE && point.distance > .1 && !pointIsMe) {
				
						var rgb = self._getRGB(point);

						var lat_ = point.lat - self.lat;
						var lng_ = point.lng - self.lng;
						var rad = Math.atan2(lat_, lng_);

						// angle is the angle from 0 that the dot is located. -180 -> 180
						var angle = (rad * (180 / Math.PI) - 90);

						vis_ids.push(point.id)

						if (clearAll) {
							$vis = $('<div class="vdot" data-id="'+ point.id +'" style=""></div>');
							self.$visualizations.prepend($vis);

						} else {
							var $vis = $('[data-id="'+point.id+'"]');
							if ($vis.length == 0) {
								$vis = $('<div class="vdot" data-id="'+ point.id +'" style=""></div>');
								self.$visualizations.append($vis);
							}

						}

						var size = self.vmax;
						$vis.css({
							height: size,
							width: size,
							top: -size / 2,
							left: -size / 2,
							'background-color': rgb,
							'z-index': Math.round(30 - point.distance)
						});

						$vis.data({ 'angle': Math.round(angle), 'distance': Math.round(point.distance) });

				
				} else {
					break;
				}

			}

			// remove unused visualizations
			self.$visualizations.children().each(function() {
				var vis = $(this);
				var visid = vis.attr('data-id');
				var inside = false;
				for (var id in vis_ids) {
					if (vis_ids[id] == visid) inside = true;
				}
				if (!inside) {
					vis.remove();
				}
			});

			
			self._drawDots(this.current_rotation, this.current_pitch);


		},

		_getRGB: function(point, opacity) {
			opacity = opacity || 1;
			var zindex = 150;
			//var zindex = Math.round(point.distance * 12);
			//var rgbarr = point.rgb.split(',');
			var rgb = 'rgba(';
			if (typeof point.name === 'string') {
				rgb += '255,255,255,1)';
			} else {
                if (point.song_number == 0) { rgb += '150,0,0,' + opacity + ')';
                } else if (point.song_number == 1) { rgb += '0,150,0,' + opacity + ')';
                } else if (point.song_number == 2) { rgb += '0,0,150,' + opacity + ')';
                } else { rgb += '255,255,255,1)'; }

			}
			return rgb;
		},




/*  ################################################################################################
	GPS
	################################################################################################
*/

		geoLocate: function () {
			if (navigator.geolocation && this.useGPS) {
				var self = this;
				self.geolocateErrorCounter = 0;
				navigator.geolocation.getCurrentPosition(
					$.proxy(this.preGeoLocated, this), // callback function to set a timer
					function(msg) { // error message
						console.log('Geolocation error: ', msg);
						if (self.geolocateErrorCounter < 20) {
							self.geolocateErrorCounter++;
							self.geoLocate();

						} else {
							// give up, geolocation is broken.
							console.log('Giving up on geolocation, too many errors.');
							self.setLatLng();
							self.geoLocated({ timestamp: new Date().getTime(), coords: {latitude: self.lat, longitude: self.lng, accuracy: self.DEFAULT_ACCURACY} });
						}
					},
					{ maximumAge: self.geolocationSpeed, timeout: self.geolocationSpeed, enableHighAccuracy: true } // position options
				);
			} else { // fake it, probably on desktop anyway
				console.log('No navigator.geolocation.', this.lat, this.lng);
				this.geoLocated({ timestamp: new Date().getTime(), coords: {latitude: this.lat, longitude: this.lng, accuracy: this.DEFAULT_ACCURACY} });
			}

		},

		preGeoLocated: function (position) {
			// Set a timer to sample the geolocation every few seconds.
			var curdate = new Date().getTime();
			if (!this.curdate) this.curdate = curdate;
			if (curdate - this.curdate > this.geolocationSpeed || this.curdate == curdate) {
				this.geoLocated(position);
				this.curdate = curdate;
			}
		},

		geoLocated: function (position) {
			// this.setTimeAnchor(position.timestamp);

			var self = this;
			//console.log('geolocated: ', position)
			if (navigator.geolocation && this.isMobile && this.useGPS) {
				navigator.geolocation.clearWatch(this.GPSInterval);
				clearTimeout(this.watchPositionTimer);
				this.watchPositionTimer = setTimeout(
					function() {
						self.GPSInterval = navigator.geolocation.watchPosition( $.proxy(self.preGeoLocated, self), null, { maximumAge: self.geolocationSpeed - 1, timeout: self.geolocationSpeed } );
					}, this.geolocationSpeed
				);
			}

			this.translateGPSCoordinates(position);

		},


		translateGPSCoordinates: function(pos) {
			//console.log('translateGPSCoordinates: ', pos)
			var self = this;

			// If this distance is too big, just reset it. This can happen on initial load.
			if (this.lat - pos.coords.latitude > .0001) {
				this.lat = pos.coords.latitude;
				this.lng = pos.coords.longitude;
			}
			
			var xdist = Math.abs(this.lat - pos.coords.latitude) * 100000;
			var ydist = Math.abs(this.lng - pos.coords.longitude) * 100000;

            // should be the distance between where we were and where we are now in meters.
			var radius = Math.pow(xdist, 2) + Math.pow(ydist, 2);

			var initialLoad = false;
			if (!this.accuracyInMeters) {
				initialLoad = true;
			}

			// // check the deltas to make sure it's above the accuracy threshold.

			if (typeof pos.coords.accuracy === 'undefined') pos.coords.accuracy = this.DEFAULT_ACCURACY;
			
			// Let server know we've moved.
			if (this.point) {
                this.point.lat = this.lat;
                this.point.lng = this.lng;
                this.point.latlng = { lat:this.lat, lng: this.lng };
                // this.point.gps_anchor = this.gps_delta;

                this.socket.emit('ping', this.point);
            }

			if (this.isMobile) {
				this.accuracyInMeters = pos.coords.accuracy; // limit this to 10 just in case there's no geolocation at all
			} else {
				this.accuracyInMeters = Math.min(pos.coords.accuracy, this.DEFAULT_ACCURACY); // limit this to 10 just in case there's no geolocation at all
			}
			// if (this.radiusCircle) this.radiusCircle.setRadius(this.accuracyInMeters);
			var accuracyDelta = this.accuracyInMeters;

			//console.log('radius: ', radius, '; xdist: ', xdist, '; ydist: ', ydist, '; accdelta: ', accuracyDelta)

			// THIS IS IMPORTANT: IT HAPPENS WHEN THE USER HAS MOVED FROM THEIR PREVIOUS LOCATION
			var cond = true;
			if (this.isMobile) cond = radius/3 > accuracyDelta || initialLoad; // only actually check mobile for radius vs accuracy. Any movement on desktop counts here.
			if (cond) {
				this.lat = pos.coords.latitude;
				this.lng = pos.coords.longitude;

                this.pointsByDistance = [];

                for (var i in this.points) {
                    if (this.points.hasOwnProperty(i)){
                        var point = this.points[i];
                        this.pointsByDistance[Math.round(point.distance * 1000)] = point.id;
                    }
                }

				// Update the distance.
				for (var i in self.points) {
					var point = self.points[i];
					var new_distance = Math.sqrt(Math.pow(point.lat - pos.coords.latitude, 2) + Math.pow(point.lng - pos.coords.longitude, 2));
					point.distance = new_distance * 100000// * this.meters_to_degrees * 10000;
				}

				this.setLatLng();
				this.map.setCenter(new google.maps.LatLng(this.lat, this.lng));

				self._placeVisualizations();
				self._drawRadius();

				if (initialLoad) this._getPoints();


			}
		},










/*  ################################################################################################
	EVENT LISTENER FUNCTIONS
	################################################################################################
*/


		resize: function () {
			this.vw 				= this.getViewport()[0]; // viewport width
			this.vh 				= this.getViewport()[1]; // viewport height
			this.vmax 				= Math.max(this.vw, this.vh); // viewport max square
			this.vmin 				= Math.min(this.vw, this.vh); // viewport max square
			this.diagonal 			= Math.round(Math.sqrt(Math.pow(this.vw, 2) + Math.pow(this.vh,2)));
			this.isMobile = this.vw <= this.TABLET_LANDSCAPE && !!('ontouchstart' in window);



			this.diagonal_diff_x 	= Math.round(this.vw/2 - this.vmax/2);
			this.diagonal_diff_y 	= Math.round(this.vh/2 - this.vmax/2);

			this.map_container.height(this.vmax).width(this.vmax);
			$('#vignette, #aural').height(this.vh).width(this.vw);
			this.$arrow.css({
				left: this.vw / 2 - this.$arrow.width()/2
				,top: this.vh / 2 - this.$arrow.height()/2
			});


			this.$visualizations.height(this.vh).width(this.vw);
			$('#err').height(this.vh).width(this.vw);

			var start = $('#loading #splash button');
			start.css({ 'margin-top': this.vh / 2 - start.height()/2 });
			$('#loading #splash').height(this.vh);


			// rotate the map so it's compass-stable
			if (this.whirlymap) {
				var t = 'translate3d('+ this.diagonal_diff_x +'px, '+ this.diagonal_diff_y +'px, 0px) rotateZ(-' + this.current_rotation + 'deg) ';
				this.map_container.css({ 'transform': t, '-webkit-transform': t })
			}
			this.map.setCenter(new google.maps.LatLng(this.lat, this.lng));
			this._drawRadius();

		},

		scroll: function () {},



		_orientationChange: function (event) {
	
			var compass, pitch;

			if (event.alpha) {

				if (event.webkitCompassHeading) {
					// ios compass reading depends entirely on which way you orient the device.
					compass = event.webkitCompassHeading + window.orientation;
					// if (compass > 360) compass = compass - 360;
					// if (compass < 0) compass = 360 + compass;
				} else {
					// android
					//compass = event.alpha;
					compass = 360 - Math.round(event.alpha);
				}

				pitch = Math.round(event.gamma); if (pitch > 0) pitch = pitch - 90; else pitch = Math.abs(pitch) - 90

				var a = Math.round(event.alpha);
				var b = Math.round(event.beta);
				var g = Math.round(event.gamma);
				var o = Math.round(window.orientation);

				// console.log(b, g, b+g, b-g, g-b)
				// console.log(a, b, g)

				if (window.orientation == 0) {
					var mod;
					if (g < 0 && g >-90) {
						mod = b-90 ;
					} else {
						mod = 90-b
					}
					pitch = mod

				}

				
			} else if (event.heading || event.pitch) {
				compass = parseInt(event.heading || 0);
				pitch = parseInt(event.pitch || 0);

			} else {
				compass = 0; pitch = 0;
			}

			// draw the actual visualizations on screen
			//compass = 360 - compass

			this._drawDots(compass, pitch);

			this.current_rotation = compass;
			this.current_pitch = pitch;


			pitch = Math.round(pitch * this.vmin/180) * 2
			this.$cube.css({ top: pitch });


			// move the direction arrow
			if (this.compass_needle) {
				var ico = this.compass_needle.getIcon();
				ico.rotation = compass;
				this.compass_needle.setIcon(ico);
			}

			// rotate the map so it's compass-stable
			if (this.whirlymap) {
				var t = 'translate3d('+ this.diagonal_diff_x +'px, '+ this.diagonal_diff_y +'px, 0px) rotateZ(-' + this.current_rotation + 'deg) ';
				this.map_container.css({ 'transform': t, '-webkit-transform': t })
			}


			// update the soundstage for orientation
			var audio_radians = compass * (Math.PI / 180)
			var x = Math.cos(audio_radians);
			var y = Math.sin(audio_radians);

			this.context.listener.setOrientation(x, y, 0, 0, 0, -1);

			if (event.latLng) {
				this.setLatLng(event.latLng.lat(), event.latLng.lng());
			}


		},

        _deletePoint: function(point) {
            this._removeSocket(point.id);
            if (point.marker) point.marker.setMap(null);
            // console.log('_deletePoint calling _stop')
            this._stop(point);
            delete this.points[point.id];
        },


        _getPoints: function () {
			// If self.resetPoints is true, we're switching medleys
			if (!this.getPointsProcessing) {
				this.getPointsProcessing = true;
				var self = this;

				if (self.album) {
					this._setMedleyId();

					var points_url = '/api/v1/points/near/'+ this.lat +'/'+ this.lng +'?medleyId='+ this.medleyId + (this.point ? '&excludeId='+ this.point.id : '');
					$.get(points_url, function(points) {


                        // MEDLEY SWITCH!
						// remove everything before adding new things
						if (self.resetPoints) {
                            // console.log('deleting current points in _getPoints')
							self._stopAll();
							self._removeMarkers();
							self.points = [];
                            self.resetPoints = false;

                            // oneOff Stinger here to signal song change
                            if (self.isLoaded) self.oneOff({ url: self.stingers[Math.floor(self.stingers.length * Math.random())] });

						} else {
                            // keep the locals up to date every load
                            for (var i in self.sockets) {
                                if (self.points[i]) {
                                    self._deletePoint(self.points[i]);
                                }
                            }
                        }



                        for (var i in points) {


							var pointId = points[i].id;

							// add points to the main points array if they don't already exist. If they do, update the distance.
							if (!self.points[pointId]) {
                                // build the things we need the point to have if it's not a person:
                                if (typeof points[i].song_number != 'undefined' && typeof points[i].song_number == 'number') {
                                    //console.log(points[i], typeof points[i].song_number)
                                    points[i].track_url = '/albums/' + self.album.name + '/' + (self.medleyId - 1) + '/' + points[i].song_number + '/' + points[i].track_number + '.mp3';
                                }
								self.points[pointId] = points[i];
							}
							var point = self.points[pointId];

							// turn on new websockets
							if (!point.track_url) {
                                if ($.inArray(point.id, self.sockets) < 0) {
                                    self._addSocket(point.id);
                                }
							}


							// if the point already exists, update its distance
							self.points[point.id].distance = point.distance;

							// create markers on the main points array, if they don't yet exist and they are not me.
							if (!point.marker) {
                                if (self.point) { // if we have an internalized point, make sure it matches.
                                    if (self.point.id != point.id) {
                                        self._createMarker(point);
                                    }
                                } else {
                                    self._createMarker(point)
                                }
							}

						}


						// delete points outside radius in main points array.
						for (var i in self.points) {
							var point = self.points[i];
							if (point.distance > self.DEFAULT_RADIUS) {
                                self._deletePoint(point);
							}
						}


						self._placeVisualizations(null, null, true);
                        self._drawRadius();

                        // hack for Google Maps v.3 to not lose the markers
                        self.map.panBy(1, 0);
                        self.map.panBy(-1, 0);

						self.isGetPointsReady = true;
						self.getPointsProcessing = false;

					});
				}
			}

			
		},




		_minuteTick: function() {
            // var self = this;
            // console.log('_minuteTick')
            // self.resetPoints = true;
			//this.isTimeAnchorReset = true;
		},



        _momentTick: function() {
            var self = this;
            this._getPoints();
            this._uploadPosition();
            // console.log('_momentTick', this.play_array.length, this.play_array)
        },


		_secondTick: function () {
			var self = this;

            this._playTracks();


		},



        _playTracks: function() {


            // start the playhead according to timestamp.
            var self = this;

            // update the playable points
            var old_play_array = [];
            if (this.play_array) old_play_array = this.play_array;
            this.play_array = [];
            this._setMedleyId();


            // This fires off if we've gotten a GPS time offset for our local clock that's more than 1/10 second latency
            // Restart all the existing tracks to sync with the new clock

            // if (true) {
            if (this.isTimeAnchorReset) {
                this.isTimeAnchorReset = false;
                //console.log('isTimeAnchorReset', this.time_anchor)

                var point_counter = 0;
                //console.log('_playTracks', this.points.length)
                for (var distance = 0; distance < this.pointsByDistance.length; distance++) {
                    if (this.pointsByDistance.hasOwnProperty(distance)) {

                        var point = this.points[this.pointsByDistance[distance]];
                        // console.log('_playTracks X:', pointId, point, point.distance < this.radius, point.track_url, this.audio[pointId])

                        if (point && point.distance < this.radius && point.track_url) {
                            if (point_counter++ < self.MAXIMUM_TRACKS_PLAYABLE) {
                                this.play_array.push(point.id);

                                if (this.audio[point.id]) {
                                    if (this.audio[point.id].isPlaying && this.audio[point.id].source) {
                                        // TODO: this is where we should space them out over the course of a second using timeouts.
                                        //console.log('_secondTick', pointId, point_counter * 50)
                                        //setTimeout(function() {
                                            // console.log('_playTracks calling _stop', point.id)
                                            self._stop(point);
                                            self._play(point);
                                        //}, point_counter * 20);
                                    }

                                } else {
                                    // console.log('_secondTick _play only', pointId)
                                    self._play(point);
                                }
                            } else {
                                this._stop(point)
                            }
                        } else {
                            this._stop(point)
                        }
                    }
                }


            // Latency good, just play
            } else {

                var point_counter = 0;
                for (var distance = 0; distance < this.pointsByDistance.length; distance++) {
                    if (this.pointsByDistance.hasOwnProperty(distance)) {

                        var point = this.points[this.pointsByDistance[distance]];

                        if (point && point.distance < this.radius && !point.name) {
                            if (point_counter++ < self.MAXIMUM_TRACKS_PLAYABLE) {
                                this.play_array.push(point.id);

                                if (this.audio[point.id]) {
                                    // do nothing! It already exists and should be playing.
                                } else {
                                    self._play(point);
                                }
                            } else {
                                self._stop(point);
                            }
                        } else {
                            self._stop(point);
                        }
                    }
                }

           }


           // //console.log(old_play_array, this.play_array)

           //  // stop songs in old play array that are not in new play array.
           //  for (var old_pointId in old_play_array) {
           //      if ($.inArray(old_play_array[old_pointId], this.play_array) >= 0) {

           //      } else {
           //          // console.log('_playTracks old_play_array calling _stop')
           //          this._stop(old_play_array[old_pointId])
           //      }
           //  }


        },








/*  ################################################################################################
	UTILITY FUNCTIONS
	################################################################################################
*/

		getViewport: function () {
			var viewPortWidth;
			var viewPortHeight;

			if (typeof window.innerWidth != 'undefined') {
				// the more standards compliant browsers (mozilla/netscape/opera/IE7) use window.innerWidth and window.innerHeight
				viewPortWidth = window.innerWidth,
				viewPortHeight = window.innerHeight
			} else if (typeof document.documentElement != 'undefined' && typeof document.documentElement.clientWidth != 'undefined' && document.documentElement.clientWidth != 0) {
				// IE6 in standards compliant mode (i.e. with a valid doctype as the first line in the document)
				viewPortWidth = document.documentElement.clientWidth,
				viewPortHeight = document.documentElement.clientHeight
			} else { // older versions of IE
				viewPortWidth = document.getElementsByTagName('body')[0].clientWidth,
				viewPortHeight = document.getElementsByTagName('body')[0].clientHeight
			}
			return [viewPortWidth, viewPortHeight];

		},


		isInView: function (elem) {
			var window_bottom = this.scrollTop + this.$window.height();

			var object_top = $(elem).offset().top;
			var object_bottom = object_top + $(elem).height();

			return (
				((object_bottom <= window_bottom) && (object_bottom >= this.scrollTop))
				||
				((object_top <= window_bottom) && (object_top >= this.scrollTop))
			);
		},



		log: function(str) {
			if ($('#err').length == 0) {
				var err = $('<div id="err"></div>');
				err.css({
					position: 'absolute', height: this.vh, width: this.vw, top: 0, left: 0, overflow: 'scroll', 'pointer-events': 'none', 'color': 'white', 'z-index': 1000,
					'-webkit-transform': 'translateZ(10000px)'
				});
				$('body').append(err);
			}

			$('#err').append('<br>' + str).scrollTop($('#err').prop("scrollHeight"));

		},


		
	}



//----------------------------------------------------------------------
// Event Handlers
//----------------------------------------------------------------------



	function handleResize(e) {
		this.resize();
	}

	function handleScroll(e) {
		this.scroll();
	}


	function handleMousemove(e) {
		this.clientX = e.clientX;
		this.clientY = e.clientY;


		var screen_center_h = this.vh / 2;
		var screen_center_w = this.vw / 2;


		if (this.clientX < screen_center_w) this.clientX = -(screen_center_w - this.clientX)
			else this.clientX = this.clientX - screen_center_w;

		if (this.clientY < screen_center_h) this.clientY = screen_center_h - this.clientY
			else this.clientY = -(this.clientY - screen_center_h);


		// on desktop, use mouse cursor to determine rotation
		if (!this.isMobile) {
			var x_ = 0 - this.clientX;
			var y_ = 0 - this.clientY;
			var rad_ = Math.atan2(x_, y_);
			var deg_ = 180 + rad_ * (180 / Math.PI);
			this.current_rotation = deg_;

			if (this.compass_needle) {
				var ico = this.compass_needle.getIcon();
				ico.rotation = this.current_rotation;
				this.compass_needle.setIcon(ico);
			}
		}

		
		var dmod = this.vh / 180;
		var pitch = this.clientY / dmod;

		this._orientationChange({heading: this.current_rotation, pitch: pitch});

	}

	function handleMouseUp(e) {
	    e.preventDefault();
	}

    function handleMouseDown(e) {
        //this.oneOff({url: this.soundboard[0] });
    }

    function handleSoundboard(e) {
        if (this.point) this.socket.emit('sing', {
            // time_anchor: this.time_anchor,
            // universal_time: this.universal_time,
            // accuracyInMeters: this.accuracyInMeters,
            name: this.point.name,
            url: this.soundboard[$(e.currentTarget).data('soundid')],
            lat: this.point.lat,
            lng: this.point.lng
        });
    }

	function handleKeyDown(e) {
		var lat = parseFloat(this.lat);
		var lng = parseFloat(this.lng);

		var deg = this.current_rotation;

        var isMove = false;

		if (e.keyCode == 87 || e.keyCode == 38) { deg += 270; isMove = true; } // up 
		if (e.keyCode == 83 || e.keyCode == 40) { deg += 90; isMove = true; } // down
		if (e.keyCode == 65 || e.keyCode == 37) { deg += 180; isMove = true; } // left
		if (e.keyCode == 68 || e.keyCode == 39) { deg += 0; isMove = true; } // right

        if (isMove) {
            var radians = deg * (Math.PI / 180); // converted to radians
            var xlat = Math.sin(radians) * this.meters_to_degrees * 2;
            var xlng = Math.cos(radians) * this.meters_to_degrees * 2;

            lat -= xlat;
            lng += xlng;

            this.geoLocated({ timestamp: new Date().getTime(), coords: { latitude: lat, longitude: lng }, accuracy: this.DEFAULT_ACCURACY });

        }
	}

	function handleMapClick(e) {
		// var lat = e.latLng.lat();
		// var lng = e.latLng.lng();

  //       location.hash = (this.locationhash ? this.locationhash : "") + "/GPS:" + lat +','+ lng + '#';
		// this.geoLocated({ timestamp: new Date().getTime(), coords: { latitude: lat, longitude: lng }, accuracy: this.DEFAULT_ACCURACY });
		
	}

	function handleMobileMapClick() {
		

	}



		
	
	//----------------------------------------------------------------------
	// Plug-in Definition
	//----------------------------------------------------------------------
	
	$.fn.view = function (option) {
		var selector = this.selector;
		var init_array = [];
		this.each(function () {
			var options = $.extend({}, $.fn.view.defaults, typeof option == 'object' && option);
			options.selector = selector;
			init_array.push(new view(this, options));
		});
		return init_array;
	}
	
	$.fn.view.Constructor = view;

	$.fn.view.defaults = {
		positionDotColor: '#36352b',// 1A1B15
		positionRadiusColor: '#E22B18', //B8B5A8
		orange: '#E22B18',// 1A1B15
		beige: '#36352b',// 1A1B15
		black: '#fff' //B8B5A8
	}

	// init the view on page load
	view = $(document).view()[0];

}(window.jQuery, window);





