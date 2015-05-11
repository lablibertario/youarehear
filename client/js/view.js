/* ***************************************************************************************

TODO:

ON DESKTOP: tell about wasd/arrow key movement

ON GPS FAIL: pop up a window with instructions to turn on GPS/Location Services in settings (Settings/Privacy in iOs) and make sure browser has access to use it

Add GPS coords to sharing, when coming in on coords allow a button for switching to live GPS mode.

Admin system for moving tracks around with drag and drop


if !isMobile on start show wasd controls
if !navigator.watchPosition -- prompt to turn on GPS/Location services (both iOS and Android)


Here are the beta comments from yesterday-
-What do dots represent? (Legend?)
-Sound board icons
-Start button should light up when pushed
-Soundboard buttons should light up when pushed
-Problems clearing tracks


Don't have all tracks restart at once for GPS time offset fixes, space them out a bit so it's not as obvious -- schedule them every 10ms
Time offsets seem to have some issues coming back from sleep on the phone -- they're off but they don't appear to know it.


facebook & twitter default tweets (with GPS location? Then we need a 'go to my location' button too )
social share graphics

SECURITY on POST: ensure data integrity? Check on edit to make sure edit id is not a track and is a person.


start pre-loading GPS tracks, but don't play until button press.



info page:
Richard bio -- link to 3232
Stefon bio -- link to bionik
Volunteer thanks
Legend
Note: save as a home page app for full-screen!
Issues: Has to be outside for GPS to work properly! Give GPS 60 seconds to warm up after starting for most accurate location.

stress-test and load-test connections.





NICE TO HAVE
visualizations: bump in time to the music



*************************************************************************************** */


!function ($, window) {

    "use strict";

//----------------------------------------------------------------------
// Class Definition
//----------------------------------------------------------------------
    
    var view = function (element, options) {
        this.$window            = $(window);
        this.$body              = $('body');
        this.$document          = $(document);  
        this.options            = options;

        this.vw                 = this.getViewport()[0]; // viewport width
        this.vh                 = this.getViewport()[1]; // viewport height

        this.TABLET_LANDSCAPE   = 1024;
        this.TABLET_PORTRAIT    = 768;
        this.MOBILE_LANDSCAPE   = 560;
        this.MOBILE_PORTRAIT    = 320;

        this.isMobile           = this.vw <= this.TABLET_LANDSCAPE && !!('ontouchstart' in window);
        this.isLoaded           = false;

        this.SECOND             = 1000;
        this.MOMENT             = 3000;
        this.MINUTE             = 10000;




        // trap console log errors in IE
        if (typeof console == "undefined") { window.console = { log: function () {} }; }



        if (typeof google !== 'undefined') {



            var url = window.location.href;
            this.url = url.substring(0, url.lastIndexOf(':'))


            this.points                 = [];
            this.pointsByDistance       = [];
            this.new_points             = [];

            this.isTimeAnchorReset      = false;

            this.meters_to_degrees      = .000007871; // for 45ºN, multiplier = 1m
            //this.meters_to_degrees        = .00001; // for 45ºN, multiplier = 1m


            this.MAXIMUM_TRACKS_PLAYABLE= this.isMobile ? 8 : 14;
            this.MAXIMUM_POINTS_VISIBLE = this.isMobile ? 50 : 150;
            this.medleyId               = 1;
            // this.gps_delta              = 0;
            this.universal_time         = new Date().getTime() / 1000;
            this.medley_offset          = 0;
            // this.medley_length          = 20; // medley is twenty seconds long
            this.medley_length          = 3 * 60; // medley is three minutes long

            this.audio                  = [];
            this.audio_buffer           = [];
            this.oneoff_buffers         = [];

            this.soundboard             = [];
            this.stingers               = [];

            this.markerIsMoving         = false;

            this.sockets                = [];

            this.isAdmin = false;


            this.useGPS                 = false; // set this to true to use current GPS location; if there isn't one, then use initial_latlng
            // this.useGPS                 = false; // set this to false to turn off all GPS processing and default to initial_latlng
            // this.initial_latlng         = [44.978584, -93.256087]; // Chicago Mall
            this.initial_latlng         = [44.972208, -93.275697]; // Peavey Plaza
            // this.initial_latlng         = [44.942986, -93.257077]; // Powderhorn
            this.initial_latlng         = [44.97220920431632, -93.27569738030434]; // ???

            this.geolocateErrorCounter  = 0;

            // check location hash for a search parameter.
            var ls = location.hash;
            if (ls) {
                ls = ls.substring(1, ls.length);
                if (ls.indexOf('__admin_') >= 0) {
                    this.isAdmin = true;
                }
                if (ls.indexOf('GPS:') > 0) {
                    var coords = ls.substring(ls.indexOf('GPS:') + 4, ls.indexOf('#'));
                    coords = coords.split(',');
                    if (coords[0] != 'undefined') {
                        this.useGPS = false;
                        this.initial_latlng = coords;
                    }
                }
            }

            this.isLocated              = false;

            this.lat                    = this.initial_latlng[0];
            this.lng                    = this.initial_latlng[1];
            this.radius                 = 20; // distance cutoff in meters for playable tracks

            this.geolocationSpeed       = this.SECOND;

            this.map_container          = $('#map');
            this.$arrow                 = $('#arrow');
            this.$cube                  = $('#cube');

            this.radiusCircle           = 0; // the accuracy radius as drawn on the map
            // this.currentDot              = 0; // the current translated position
            this.compass_needle         = 0;
            this.compass_needlecircle   = 0;
            this.DEFAULT_ACCURACY       = .1;
            this.DEFAULT_RADIUS         = 20;

            this.current_rotation       = 0;
            this.current_pitch          = 0;

            this.visualizations         = [];

            // this.latlngbounds           = new google.maps.LatLngBounds(); // This lets us zoom the map to fit our markers

            google.maps.event.addDomListener(window, 'load', $.proxy(this.init, this));


            // if (this.isMobile) console.log = this.log;


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

            $(function() { FastClick.attach(document.body); });

            $('#loading').height(this.vh);

            self.geoLocate();
            $.get('/api/v1/albums/1/list', function(album) {

                self.$visualizations    = $('#visualizations');
                self.album = album[0];

                self._initListeners();
                self._initMap();
                self._initAudio();
                self._initSockets();
                self._initOneoffs();

                // self.geoLocate();
            });


        },

        _initListeners: function () {
            this.$window.on('resize', $.proxy(handleResize, this));
            this.$window.on('mousemove', $.proxy(handleMousemove, this));
            this.$window.on('mousedown', $.proxy(handleMouseDown, this));
            this.$window.on('rightclick', $.proxy(handleContextMenu, this));
            this.$window.on('keydown', $.proxy(handleKeyDown, this));            
            window.addEventListener('deviceorientation', $.proxy(this._orientationChange, this), false);
        },




        displayStartButton: function () {
            // called from _initOneoffs() when the initial stinger is done loading
            this.resize(); // make sure everything lines up nice

            var self = this;

            $('#loading button').click(function() { self.startButtonClick(); });
            
            $('#loading #init').hide();

            var start = $('#loading #splash button');
            start.css({ 'margin-top': this.vh / 2 - start.height()/2 });

            if (!this.isMobile) $('#keyboard_info').show()

            $('#loading #splash').show();


        },

        startButtonClick: function () {
            var self = this;

            this.$arrow.fadeIn();

            // initial stinger
            self.oneOff({url: '/albums/Northern Spark/stingers/01.mp3', callback: function() {

                // self.geoLocate();

                self._secondTick();
                self._getTime();
                // set off tick timers
                setInterval(function() {
                    self._secondTick();
                }, self.SECOND);
                setInterval(function() {
                    self._momentTick();
                }, self.MOMENT);
                setInterval(function() {
                    self._minuteTick();
                }, self.MINUTE);

                $('#loading').fadeOut();
                self.isLoaded = true; // let the app know things are done

            } });

            
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
            google.maps.event.addListener(this.map, 'mouseup', $.proxy(handleMapMouseup, this));
            google.maps.event.addListener(this.map, 'drag', $.proxy(handleMapDrag, this));

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
            // this.latlngbounds.extend(glatlng);
            
        
            var rgb = self._getRGB(point);

            var marker_icon = new google.maps.Marker({
                map: self.map,
                position: glatlng,
                title: point.track_url,
                optimized: false,
                clickable: this.isAdmin,
                pointId: point.id,
                // zIndex: 3,
                icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 12,
                    fillColor: rgb,
                    fillOpacity: 1,
                    strokeOpacity: 0,
                    //strokeColor: '#ffffff',
                    origin: new google.maps.Point(0,0),
                    anchor: new google.maps.Point(0,0)
                }
            });

            point.marker = marker_icon;

            if (this.isAdmin) {
                google.maps.event.addListener(marker_icon, 'mousedown', function(e) {
                    self.markerMoving = marker_icon;
                    self.markerIsMoving = true;
                });
 
                 google.maps.event.addListener(marker_icon, 'rightclick', function(e) {
                    self.markerMoving = marker_icon;
                    self.markerIsMoving = true;
                });
            }

            
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


        _deletePoint: function(pointId) {
            // console.log('_deletePoint calling _stop', pointId)
            this._removeSocket(pointId);
            for (var i in this.pointsByDistance) {
                if (this.pointsByDistance[i] == pointId) delete this.pointsByDistance[i];
            }
            this._stop(pointId);

            var point = this.points[pointId];
            if (point) {
                if (point.marker) point.marker.setMap(null);
                delete this.points[pointId];
            }
        },


        _getPeople: function () {
            var self = this;
            if (this.isLocated == true) { // this can only happen after we know where we are

                // make the points call
                var points_url = '/api/v1/points/near/'+ this.lat +'/'+ this.lng + '?people=true' + (this.point ? '?excludeId='+ this.point.id : '');
                $.get(points_url, function(points) {

                    var new_points = [];
                    for (var i in points) {
                        if (points.hasOwnProperty(i)) {

                            var pointId = points[i].id;

                            if (!self.points[pointId]) {
                                self.points[pointId] = points[i];
                            }

                            if ($.inArray(pointId, self.sockets) < 0) {
                                self._addSocket(pointId);
                            }

                            new_points[pointId] = pointId;

                        }

                    }

                    // delete any people that have disappeared from the db
                    for (var i in self.sockets) {
                        if ($.inArray(parseInt(i), new_points) < 0) {
                            self._deletePoint(i);
                        }
                    }


                });
            }
        },


        _getPoints: function () {
            var self = this;
            if (this.isLocated == true) { // this can only happen after we know where we are
                // if location hasn't changed, don't get new points.
                if (this.isPositionUpdated) {
                    this.isPositionUpdated = false;

                    if (!this.getPointsProcessing) { // don't start another points process until this one is finished.
                        this.getPointsProcessing = true;

                        if (self.album) { // can't do this unless we have an album downloaded. We should, if we don't there are big problems anyway.

                            // make the points call
                            var points_url = '/api/v1/points/near/'+ this.lat +'/'+ this.lng + (this.point ? '?excludeId='+ this.point.id : '');
                            $.get(points_url, function(points) {

                                self.updateMedleyId(); // figure out what medley we're in


                                for (var i in points) {
                                    if (points.hasOwnProperty(i)) {

                                        var pointId = points[i].id;

                                        if (!self.points[pointId]) {
                                            self.points[pointId] = points[i];
                                        }

                                        var point = self.points[pointId];

                                        if (typeof point.song_number != 'undefined' && typeof point.song_number == 'number') {
                                            // update the track_url for each point to reflect the new medley
                                            point.track_url = '/albums/' + self.album.name + '/' + (self.medleyId - 1) + '/' + point.song_number + '/' + point.track_number + '.mp3';

                                        }

                                    }

                                }

                                self.getPointsProcessing = false;
                                self._secondTick();

                            });
                        }
                    }
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


        _initOneoffs: function() {

            var self = this;

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


            // preload stingers
            self.stingers[0] = '/albums/Northern Spark/stingers/01.mp3';
            self.stingers[1] = '/albums/Northern Spark/stingers/02.mp3';

            for (var i in self.stingers) {
                self.oneOff({ url: self.stingers[i], preloadOnly: true });
            }

            // when stinger is loaded, finish up the load when initial stinger is preloaded.
            self.oneOff({
                url: '/albums/Northern Spark/stingers/01.mp3',
                callback: function() {
                    // This finishes the initial load
                    self.displayStartButton();
                },
                preloadOnly: true
            });

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
            if (self.oneoff_buffers[arg.url]) {
                // we've played this one before, we've stored a buffer
                if (!arg.preloadOnly) self.oneoff_buffers[arg.url] = self._playBuffer(self.oneoff_buffers[arg.url], lat, lng);
                if (arg.callback) if (typeof arg.callback == 'function') arg.callback();

            } else {
                // we haven't played this one yet, have to load it first.
                self.oneoff_buffers[arg.url] = { id:123, track_url: arg.url };
                var stingerLoader = new AudioLoader (
                    self.context,
                    self.oneoff_buffers[arg.url],
                    function (buffer, pointId) {
                        var tmpaud = {};
                        tmpaud.buffer = buffer;
                        self.oneoff_buffers[arg.url] = tmpaud;

                        if (!arg.preloadOnly) self.oneoff_buffers[arg.url] = self._playBuffer(self.oneoff_buffers[arg.url], lat, lng);
                        if (typeof arg.callback == 'function') arg.callback();
                    }
                );
                stingerLoader.load();
            }

        },



        setAudioPosition: function (lat, lng) {
            if (!lat) { lat = this.lat; } else { this.lat = lat; }
            if (!lng) { lng = this.lng; } else { this.lat = lng; }

            this.context.listener.setPosition(lat, lng, 0);
        },









        _play: function (point) {
            // console.log('_play', point.id)

            if (point) {
                if (this.audio[point.id]) { // is it already playing?
                    if (!this.audio[point.id].isPlaying && this.audio[point.id].source) {
                        var src = this.audio[point.id].source;

                        this.updateMedleyOffset();

                        var starthere = this.medley_offset % src.buffer.duration;
                        try {

                            if (src.noteOn) {
                                src.noteGrainOn(this.context.currentTime, starthere,  src.buffer.duration - starthere);

                            } else {
                                src.start(0, starthere);

                            }


                            this.audio[point.id].isPlaying = true;
                            // console.log('played', point.id, this.audio[point.id].isPlaying)

                        } catch (e) {
                            console.log('caught', point.id, this.audio[point.id].isPlaying)
                        }

                    } else {
                        console.log('broken', point.id)
                    }

                } else {
                    // console.log('_play: point not in this.audio: ', point.id)
                    // load it, then play
                    this._loadTrack(point);
                }
            } else {
                console.log('_play: point does not exist: ', point)
            }
        },

        _stop: function (pointId) {
            if (this.audio[pointId]) {

                if (this.audio[pointId].isPlaying && this.audio[pointId].source) {
                    // console.log('_stop', pointId)
                    if (this.audio[pointId].source.noteOff) {
                        this.audio[pointId].source.noteOff(0);
                    } else {
                        try{
                            this.audio[pointId].source.stop(0);
                        } catch (e) {
                            console.log(e, pointId)
                        }
                    }
                }
                delete this.audio[pointId];
            }
        
        },

        _stopAll: function () {
            // console.log('_stopAll calling _stop')
            for (var i in this.points) {
                this._stop(this.points[i].id);
            }
        },



        _loadTrack: function (point) {
            //console.log('_loadTrack', point.id)
            var self = this;
            var pointId = point.id;
            var point = this.points[point.id];

            if (!this.audio[pointId]) {

                if (!this.audio_buffer[point.track_url]) {
                    this.audio_buffer[point.track_url] = { isLoading: true };
                    // console.log('loadTrack: track is not in audio_buffers', point.track_url)
                    var audioLoader = new AudioLoader (
                        this.context,
                        point,
                        $.proxy(this._audioOnLoad, this)
                    );

                    audioLoader.load();

                } else if (!this.audio_buffer[point.track_url].buffer) {
                    // console.log('still loading buffer', point.id, point.track_url)
                } else {
                    // console.log('_createAudioBufferNode from _loadTrack', pointId)
                    this._createAudioBufferNode(pointId);

                }
            }

        },


        _createAudioBufferNode: function (pointId, loop) {
            var point = this.points[pointId];

            if (point) {

                this.audio[pointId] = {};

                this.audio[pointId].source = this.context.createBufferSource(); // this is a one-shot thing. Once stopped, can never be started again.
                this.audio[pointId].source.buffer = this.audio_buffer[point.track_url].buffer;
                
                this.audio[pointId].source.loop = !loop; // if you pass in true, it will play only once
                //this.audio[pointId].source.loop = false; // if we restart everything once a second anyway, there's no need to loop.

                this.audio[pointId].panner = this.context.createPanner();
                this.audio[pointId].panner.refDistance = .00008;
                this.audio[pointId].panner.rolloffFactor = 10;
                this.audio[pointId].panner.setPosition(point.lat, point.lng, 0);
                this.audio[pointId].panner.connect(this.context.destination);
                this.audio[pointId].source.connect(this.audio[pointId].panner);

            } else {
                console.log('_createAudioBufferNode: Point missing: ', pointId, point.track_url)
            }

        },



        _audioOnLoad: function (buffer, pointId) {
            // console.log('_audioOnLoad', pointId)
            var point = this.points[pointId];

            if (point) {
                this.audio_buffer[point.track_url].buffer = buffer;
                this._createAudioBufferNode(pointId);
                this._play(point);

            } else {
                // this may happen if the track is not finished loading before the point moves out of range
                console.log('_audioOnLoad: Point missing: ', pointId)
            }

        },





        _playTracks: function() {


            // start the playhead according to timestamp.
            var self = this;

            // update the playable points
            this.updateMedleyId();


            // This fires off if we've gotten a GPS time offset for our local clock that's more than 1/10 second latency
            // Restart all the existing tracks to sync with the new clock

            // if (true) {
            // if (false) {
            if (this.isTimeAnchorReset) {
                this.isTimeAnchorReset = false;

                var point_counter = 0;
                //console.log('_playTracks', this.points.length)
                for (var distance = 0; distance < this.pointsByDistance.length; distance++) {

                    if (this.pointsByDistance.hasOwnProperty(distance)) {

                        var point = this.points[this.pointsByDistance[distance]];

                        if (point && point.track_url) {
                            // point exists and is not a person
                            if (point.distance < this.radius) {
                                // point is within radius
                                if (point_counter++ < self.MAXIMUM_TRACKS_PLAYABLE) {
                                    // point is in the top few closest tracks
                                    //if (this.audio[point.id] && this.audio[point.id].isPlaying) {
                                        // TODO: this is where we should space them out over the course of a second using timeouts.
                                        // console.log('_secondTick', point.id, point_counter * 50)
                                        // setTimeout(function() {
                                        //     this.updateMedleyId();
                                            self._stop(point.id);
                                            self._play(point);
                                        // }, point_counter * 20);
                                    // } else {
                                    //     self._play(point);
                                    // }


                                // point is outside max tracks, stop it.
                                } else {
                                    self._stop(point.id);
                                }

                            // point is outside radius.
                            } else  {
                                this._deletePoint(point.id);
                            }

                        // point either does not exist, or is a person
                        } else {
                            // console.log('_playTracks: ', distance, point, this.pointsByDistance[distance])
                        }
                    }
                }


            // Latency good, just play
            } else {


                var point_counter = 0;
                for (var distance = 0; distance < this.pointsByDistance.length; distance++) {
                    if (this.pointsByDistance.hasOwnProperty(distance)) {

                        var point = this.points[this.pointsByDistance[distance]];

                        if (point && point.track_url) {
                            // point exists and is not a person
                            if (point.distance < this.radius) {
                                // point is within radius
                                if (point_counter++ < self.MAXIMUM_TRACKS_PLAYABLE) {
                                    // point is in the top few closest tracks
                                    if (this.audio[point.id] && this.audio[point.id].isPlaying) {
                                        // point has an audio entry. do nothing! It already exists and should be playing.
                                        // console.log('_playTracks: ', point.id, 'is already playing', this.audio[point.id])
                                    } else {
                                        self._play(point);
                                    }


                                // point is outside max tracks, stop it.
                                } else {
                                    self._stop(point.id);
                                }

                            // point is outside radius.
                            } else  {
                                this._deletePoint(point.id);
                            }

                        // point either does not exist, or is a person
                        } else {
                            // console.log('_playTracks: ', distance, point, this.pointsByDistance[distance])
                        }
                    }
                }

          }



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
            });
            this.socket.on('pong', function(data) {
                if (data && self.point)
                if (self.points[data.id] && data.id != self.point.id) {
                    // console.log('pong', data.server_time, d.getTime(), data.server_time - d.getTime())
                    if (self.points[data.id]) if (self.points[data.id].marker) self.points[data.id].marker.setPosition( new google.maps.LatLng (data.lat, data.lng) );
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
            // This is the heartbeat for our current location. If we don't keep updating the server, we disappear from others.
            if (this.isLocated == true) {

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

                        // heartbeat to server: update date
                        if (this.point.date) {
                            var d = new Date(this.point.date);
                            var sec = d.getSeconds();
                            d.setSeconds(sec + (self.MOMENT / 1000))
                            if (sec >= 60) {
                                d.setSeconds(0); d.setMinutes(d.getMinutes() + 1);
                            }

                            point.date = d;
                        }

                        $.ajax({
                            type: 'PUT',
                            url: upd_posturl,
                            data: point,
                            success: $.proxy(self._uploadPositionSuccess, self),
                            // if it 404s try just adding the point again, it may have gotten deleted
                            error: function() { self._addMyPoint(posturl); }
                        });
                   

                    } else {
                        // add my point, it doesn't exist yet.
                        this._addMyPoint(posturl);

                    }
                }
            }

        },


        _addMyPoint: function(posturl) {
            // add
            var self = this;    
            var point = {
                trackId: 0,
                lat: this.lat,
                lng: this.lng,
                latlng: {lat:this.lat, lng: this.lng},
                accuracy: this.accuracyInMeters,
                name: this.point ? this.point.id : 'person'
            };
            $.post(posturl, point, $.proxy(self._uploadPositionSuccess, self));

        },









/*  ################################################################################################
    TIMING AND SYNCHRONIZATION
    ################################################################################################
*/


        updateMedleyId: function () {

            var album_length = this.medley_length * this.album.medleys.length;

            // Find current medley. 
            this.updateMedleyOffset();
            var medley = Math.floor((this.universal_time % album_length) / this.medley_length);

            var new_medley = this.album.medleys[medley];
            // console.log('updateMedleyId', this.medleyId, new_medley.id, this.isLoaded)

            // NEW MEDLEY: Reset buffers and junk
            if (this.medleyId != new_medley.id) {
                this.medleyId = new_medley.id;
                this.resetMedley();
            }

        },

        updateMedleyOffset: function () {
            this.universal_time = new Date().getTime();
            if (typeof this.time_anchor != 'undefined') {
                this.universal_time += this.time_anchor;
            }
            this.universal_time /= 1000;
            this.medley_offset = (this.universal_time % (this.medley_length));
            //console.log('updateMedleyOffset', this.universal_time)
        },

        resetMedley: function() {
            if (this.isLoaded) {
                // console.log('resetting medley', this.points)
                this.oneOff({ url: this.stingers[Math.floor(this.stingers.length * Math.random())] });
                this._stopAll();
                this.audio = [];
                this.audio_buffer = [];

                for (var i in this.points) {
                    if (this.points.hasOwnProperty(i)) {
                        var point = this.points[i];
                        // update the track_url for each point to reflect the new medley
                        if (typeof point.song_number != 'undefined' && typeof point.song_number == 'number') {
                            point.track_url = '/albums/' + this.album.name + '/' + (this.medleyId - 1) + '/' + point.song_number + '/' + point.track_number + '.mp3';
                        }
                    }
                }

            }
        },

        updateTimeAnchor: function(t, lag) {

            if (typeof t !== 'undefined') {
                var nextTimeAnchor = t - new Date().getTime(); // Trying to compensate for ping time;

                if (typeof this.time_anchor != 'undefined') {

                    var delta = nextTimeAnchor - this.time_anchor;
                    // console.log('updateTimeAnchor: ')
                    // console.log('     nextTimeAnchor:' + nextTimeAnchor + '; ' + typeof nextTimeAnchor)
                    // console.log('     this.time_anchor:' + this.time_anchor  + '; ' + typeof this.time_anchor)
                    // console.log('     delta:' + delta  + '; ' + typeof delta)
                    // console.log('     lag:' + lag  + '; ' + typeof lag)
                    // console.log('     lagdiff:' + (delta - lag) )
                    // console.log('     this.universal_time:' + this.universal_time  + '; ' + typeof this.universal_time)

                    if (Math.abs(delta) > 100) { // only reset if it's off by more than 1/5 of a second. Includes ping time
                        this.isTimeAnchorReset = true;
                        this.time_anchor = nextTimeAnchor - (lag/2);
                    }

                } else { // first time through, just set it.
                    // console.log('updateTimeAnchor 1', nextTimeAnchor, t)
                    this.isTimeAnchorReset = true;
                    this.time_anchor = nextTimeAnchor;
                }
            }
        },















/*  ################################################################################################
    GPS
    ################################################################################################
*/


        _getTime: function() {
            // poll the server for the current time
            var self = this;
            var test = new Date().getTime();
            $.get('/api/v1/points/time', function(time) {
                self.updateTimeAnchor(time, new Date().getTime() - test);
            })
        },

        errorGeolocating: function() {
            console.log('please turn on GPS and location services', this.isMobile, navigator)
            $('#gps_info').show()

            if (this.isMobile) {
                if (this.isIOS) $('#gps_info').prop('href', 'https://support.google.com/coordinate/answer/2800543?hl=en'); // iOS
                if (this.isAndroid) $('#gps_info').prop('href', 'https://support.google.com/coordinate/answer/2569281?hl=en&ref_topic=3056956'); // Android

            } else {
                $('#gps_info').prop('href', 'https://support.google.com/chrome/answer/142065?hl=en'); // Chrome
            }


        },


        geoLocate: function () {
            var self = this;
            if (navigator.geolocation && this.useGPS) {
                navigator.geolocation.getCurrentPosition(
                    function() { // callback function to set a timer
                        self.isLocated = true;
                        self.GPSInterval = navigator.geolocation.watchPosition( $.proxy(self.setGPSLocation, self), null, { maximumAge: self.MINUTE, timeout: self.MOMENT } );
                    },
                    function(msg) { // error message
                        console.log('Geolocation error: ', msg);
                        if (self.geolocateErrorCounter < 20) { // it's common to get a few errors at first
                            self.geolocateErrorCounter++;
                            self.geoLocate();

                        } else {
                            // give up, geolocation is broken.
                            console.log('Giving up on geolocation, too many errors.');
                            self.errorGeolocating();
                            self.isLocated = true;
                            // self.setAudioPosition();
                            self.setGPSLocation({ timestamp: new Date().getTime(), coords: {latitude: self.lat, longitude: self.lng, accuracy: self.DEFAULT_ACCURACY} });
                        }
                    },
                    { maximumAge: self.geolocationSpeed, timeout: self.geolocationSpeed, enableHighAccuracy: true } // position options
                );
            } else { // fake it, probably on desktop anyway
                this.isLocated = true;
                console.log('No navigator.geolocation.', this.lat, this.lng);
                self.errorGeolocating();
                this.setGPSLocation({ timestamp: new Date().getTime(), coords: {latitude: this.lat, longitude: this.lng, accuracy: this.DEFAULT_ACCURACY} });
            }

        },

        setGPSLocation: function(position) {
            if (typeof this.position == 'undefined' || (this.position.coords.latitude != position.coords.latitude && this.position.coords.longitude != position.coords.longitude)) {
                this.position = position;
                this.isPositionUpdated = true;
            }
        },








/*  ################################################################################################
    EVENT LISTENER FUNCTIONS
    ################################################################################################
*/


        resize: function () {
            this.vw                 = this.getViewport()[0]; // viewport width
            this.vh                 = this.getViewport()[1]; // viewport height
            this.vmax               = Math.max(this.vw, this.vh); // viewport max square
            this.vmin               = Math.min(this.vw, this.vh); // viewport max square
            this.diagonal           = Math.round(Math.sqrt(Math.pow(this.vw, 2) + Math.pow(this.vh,2)));
            this.isMobile = this.vw <= this.TABLET_LANDSCAPE && !!('ontouchstart' in window);



            this.diagonal_diff_x    = Math.round(this.vw/2 - this.vmax/2);
            this.diagonal_diff_y    = Math.round(this.vh/2 - this.vmax/2);

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
            $('#loading #splash button').css({ "left": (this.vw / 2) - ($('#loading #splash button').width() / 2) });

            $('#loading #splash #keyboard_info').css({ "left": (this.vw / 2) - ($('#loading #splash #keyboard_info').width() / 2) });

            // rotate the map so it's compass-stable
            var t = 'translate3d('+ this.diagonal_diff_x +'px, '+ this.diagonal_diff_y +'px, 0px) rotateZ(-' + this.current_rotation + 'deg) ';
            this.map_container.css({ 'transform': t, '-webkit-transform': t })
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


            this.current_rotation = compass;
            this.current_pitch = pitch;


            // move the direction arrow
            if (this.compass_needle) {
                var ico = this.compass_needle.getIcon();
                ico.rotation = compass;
                this.compass_needle.setIcon(ico);
            }

            // rotate the map so it's compass-stable
            var t = 'translate3d('+ this.diagonal_diff_x +'px, '+ this.diagonal_diff_y +'px, 0px) rotateZ(-' + this.current_rotation + 'deg) ';
            this.map_container.css({ 'transform': t, '-webkit-transform': t })



            // update the soundstage for orientation
            var audio_radians = compass * (Math.PI / 180)
            var x = Math.cos(audio_radians);
            var y = Math.sin(audio_radians);

            this.context.listener.setOrientation(x, y, 0, 0, 0, -1);

        },



        _minuteTick: function() {
            // console.log('_minuteTick')
            // set offset from the server to sync everyone.
            // this._getTime();

        },



        _momentTick: function() {
            // console.log('_momentTick')
            this._uploadPosition();
            this._getPoints();
            this._getPeople();
            this._getTime();
        },


        _secondTick: function () {
            // console.log('_secondTick')

            if (this.position) {
                this.lat = this.position.coords.latitude;
                this.lng = this.position.coords.longitude;

                if (this.isMobile) {
                    this.accuracyInMeters = this.position.coords.accuracy; // limit this to 10 just in case there's no geolocation at all
                } else {
                    this.accuracyInMeters = this.DEFAULT_ACCURACY; // limit this to 10 just in case there's no geolocation at all
                }


                // center map on our new location
                this.map.setCenter(new google.maps.LatLng(this.lat, this.lng));

                // update accuracy radius image
                this._drawRadius();

                // let audio subsystem know we've moved.
                this.setAudioPosition();

                // Let subscriber sockets know we've moved.
                if (this.point) {
                    this.point.lat = this.lat;
                    this.point.lng = this.lng;
                    this.point.latlng = { lat:this.lat, lng: this.lng };
                    this.socket.emit('ping', this.point);
                }


                // Update the points arrays and markers, recalculate distances to points
                this.pointsByDistance = [];

                for (var i in this.points) {
                    if (this.points.hasOwnProperty(i)){

                        var point = this.points[i];

                        if (point) {

                            // get the new distance to the point
                            var new_distance = Math.sqrt(Math.pow(point.lat - this.position.coords.latitude, 2) + Math.pow(point.lng - this.position.coords.longitude, 2));
                            point.distance = new_distance * 100000// * this.meters_to_degrees * 10000;

                            // if point is too far away, just delete it
                            if (point.distance > this.DEFAULT_RADIUS) {
                                this._deletePoint(point.id);

                            } else {
                            // otherwise, add it to the points by distance array for playing
                                this.pointsByDistance[Math.round(point.distance * 1000)] = point.id;

                                // create markers on the main points array, if they don't yet exist and they are not me.
                                if (!point.marker) {
                                    if (this.point) { // if we have an internalized point, don't draw it on the map.
                                        if (this.point.id != point.id) {
                                            this._createMarker(point);
                                        }
                                    } else {
                                        this._createMarker(point)
                                    }
                                }

                            }


                        }
                    }
                }
            

                // hack for Google Maps v.3 to not lose the markers
                this.map.panBy(1, 0);
                this.map.panBy(-1, 0);

                // play anything left not already playing.
                this._playTracks();

            }


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
        if (!this.isAdmin) {

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
                this.current_rotation = 360 - deg_;
            }

            
            var dmod = this.vh / 180;
            var pitch = this.clientY / dmod;

            this._orientationChange({heading: this.current_rotation, pitch: pitch});
        }

    }

    function handleMouseUp(e) {
        e.preventDefault();
    }

    function handleMouseDown(e) {
        e.preventDefault();
    }

    function handleSoundboard(e) {
        if (this.point) this.socket.emit('sing', {
            name: this.point.name,
            url: this.soundboard[$(e.currentTarget).data('soundid')],
            lat: this.point.lat,
            lng: this.point.lng
        });
    }

    function handleKeyDown(e) {

        e.keyCode = e.keyCode || e.which;

        if (this.isLocated == true) {

            var lat = parseFloat(this.lat);
            var lng = parseFloat(this.lng);

            var deg = this.current_rotation || 10;

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

                this.setGPSLocation({ timestamp: new Date().getTime(), coords: { latitude: lat, longitude: lng }, accuracy: this.DEFAULT_ACCURACY });
                this._secondTick();

            }
        }
    }

    function handleMapClick(e) {
        var lat = e.latLng.lat();
        var lng = e.latLng.lng();
        console.log(lat + ', ' + lng)


        // if (this.isAdmin) {
        //     this.setGPSLocation({ timestamp: new Date().getTime(), coords: { latitude: lat, longitude: lng }, accuracy: this.DEFAULT_ACCURACY });
        // }

        // location.hash = (this.locationhash ? this.locationhash : "") + "/GPS:" + lat +','+ lng + '#';
        // this.geoLocated({ timestamp: new Date().getTime(), coords: { latitude: lat, longitude: lng }, accuracy: this.DEFAULT_ACCURACY });
        
    }

    function handleMapDrag(e) {
        console.log(e)
    }


    function handleMapMouseup(e) {

        if (this.isAdmin) {
            var lat = e.latLng.lat();
            var lng = e.latLng.lng();

            var self = this;
            var posturl = '/api/v1/points';


            if (this.markerIsMoving) {

                var upd_posturl = posturl +  '/' + this.markerMoving.pointId;

                var p = this.points[this.markerMoving.pointId];

                var point = {
                    "id":p.id,
                    "lat":lat,
                    "lng":lng,
                    "accuracy":null,
                    "date":p.date,
                    "socket_address":null,
                    "name":null,
                    "trackId":null,
                    "latlng":{"lat":lat,"lng":lng},
                    "song_number":p.song_number,
                    "track_number":p.track_number
                }

                var marker = this.markerMoving;
                marker.setPosition(e.latLng);

                $.ajax({
                    type: 'PUT',
                    url: upd_posturl,
                    data: point,
                    success: function (e) {    },
                    // if it 404s try just adding the point again, it may have gotten deleted
                    error: function(e) { console.log('NOT updated', e) }
                });

                this.markerIsMoving = false;
                

            }
               
        }

    }
    function handleContextMenu(e) {
        console.log('rightclick')

        if (this.isAdmin) {
 
            var self = this;
            var posturl = '/api/v1/points';


            if (this.markerIsMoving) {

                var upd_posturl = posturl +  '/' + this.markerMoving.pointId;

                $.ajax({
                    type: 'DELETE',
                    url: upd_posturl,
                    success: function (e) {    },
                    // if it 404s try just adding the point again, it may have gotten deleted
                    error: function(e) { console.log('NOT updated', e) }
                });

                this.markerIsMoving = false;
                

            }
               
        }

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





