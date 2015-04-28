module.exports = function(Point) {




    Point.time = function (callback) {

        var now = Date.now();

        callback(null, now);

    }



	// /points/near?lat=44.9439&lng=-93.2834&radius=15&max=10
	Point.near = function(lat, lng, radius, max, excludeId, medleyId, people, callback) {
		// note: radius is in meters


		var GeoPoint = require('loopback').GeoPoint;
		var geolocationSpeed = 6; // in seconds
		var meters_to_degrees = .000007871; // for 45ºN, multiplier = 1m

		var depth = 0;
		var songs = [];

		if (!latlng) var latlng = new GeoPoint({lat:lat, lng:lng});

		// set some sane defaults:
        people = people || false;
        if (!medleyId) medleyId = 1;
		if (!lat) lat = 44.943962;
		if (!lng) lng = -93.283302;
		if (!radius) radius = 20; // in meters, the radius we're checking.
		var radius_in_lat = radius * meters_to_degrees;


		var SONG_RADIUS = 10; // in meters, the radius that contains a single song
		SONG_RADIUS = SONG_RADIUS * meters_to_degrees;

        var SONGS_PER_RADIUS = 5; // how many songs fit inside the radius we're checking
        var SONGS_PER_MEDLEY = 3; // how many songs per medley
		var TRACKS_PER_SONG = 6; // how many tracks per song
		var MAX_POINTS_PER_RADIUS = Math.floor( SONGS_PER_RADIUS * TRACKS_PER_SONG / Math.PI); // simple calculation to find total points within radius we're checking.





		var _findPoint = function() {

			// if we want to keep the db minty fresh:
			var del_old_people = 'delete from points where name IS NOT NULL and date < (NOW() - INTERVAL 6 SECOND)';
			Point.dataSource.connector.query(del_old_people, function(res) {  });

            var sql_string = buildSqlSimple(lat, lng, people);
			Point.dataSource.connector.query(sql_string, result_callback);

		}




        var result_callback = function(err, points) {
            if (err) {
                console.log(err)

            } else {

                // If there are not max points returned PER MEDLEY, add a few more to points PER MEDLEY to fill out the space
                // Pick a point one song's length away from the current point and fill it with songs, if none are too close already.

                //if (points.length < MAX_POINTS_PER_RADIUS) {
                if (points.length <= 0 && !people) {
                    console.log('Less than max points. Adding points.', points.length, MAX_POINTS_PER_RADIUS, MAX_POINTS_PER_RADIUS - points.length);                   
                    // Need to place tracks in song groups. Pick a random point, fill a 10m radius around it with tracks of one song. Keep going until max points are reached
                    // Loop: #songs in medley
                    //  place one random point in 100m radius; use that as tmpcenter
                    //      loop: #tracks in song, place each in 10m radius around tmpcenter.
                    //  

                    var total_new_points = MAX_POINTS_PER_RADIUS - points.length

                    var fillRadius_sql_str = ' insert into points (track_number, song_number, lat, lng, latlng) values ' + fillRadius(lat, lng);
                    fillRadius_sql_str = fillRadius_sql_str.substring(0, fillRadius_sql_str.length - 2) + ';';
                    //console.log(fillRadius_sql_str);
                    Point.dataSource.connector.query(fillRadius_sql_str, function(err, res) {  });

                    _findPoint();


                } else {
                    // cut it down to just the nearest ones.
                    callback(null, points.slice(0, MAX_POINTS_PER_RADIUS * 2));
                }
            }
        }


        var fillRadius = function(_lat, _lng) {
            var sql_str = '';
            for (var i = 0; i < SONGS_PER_RADIUS; i++) {
                var song_number = Math.floor(Math.random() * SONGS_PER_MEDLEY);

                // center the song around a random point between center and radius edge
                var center_lat = (_lat + Math.random() * radius_in_lat * rnd_sign());
                var center_lng = (_lng + Math.random() * radius_in_lat * rnd_sign());

                for (var track_number = 0; track_number < TRACKS_PER_SONG; track_number++) {
                    sql_str += _makePoint(track_number, song_number, center_lat, center_lng, SONG_RADIUS);
                }
            }

            return sql_str;

        }



        var _makePoint = function(track_number, song_number, _lat, _lng, _radius) {
            var new_lat = (_lat + Math.random() * _radius * rnd_sign());
            var new_lng = (_lng + Math.random() * _radius * rnd_sign());
            var new_latlng = new GeoPoint({ lat: new_lat, lng: new_lng });

            var point_sql = ' ('+track_number+','+song_number+','+new_lat+','+new_lng+', GeomFromText(\'POINT('+new_lat + ' ' + new_lng +')\')), '

            return point_sql;

        }










		var rnd_sign = function() {
			return Math.random() >= .5 ? 1 : -1
		}



        var buildSqlSimple = function(tlat, tlng, onlyPeople, limit) {
            tlat = tlat || lat;
            tlng = tlng || lng;

            // Massive sql to return all points within the radius of center in order of distance.
            var sql_string = '';
            sql_string += ' SELECT ';
            sql_string += ' points.id, lat, lng, date, latlng, track_number, song_number, ';
            //sql_string += ' medleyId, songId, albumId, tracks.name as track_name, ';
            //sql_string += ' songs.name as song_name, medleys.name as medley_name, albums.name as album_name, ';
            //sql_string += " CONCAT_WS('/', '/albums', albums.name, medleys.name, songs.name, tracks.name) as track_url, ";
            sql_string += ' ( 6371000 * acos ( cos ( radians('+ lat +') ) * cos( radians( lat ) ) * cos( radians( lng ) - radians('+ tlng +') ) + sin ( radians('+ tlat +') ) * sin( radians( lat ) ) ) ) AS distance ';
            sql_string += ' FROM points ';
            sql_string += ' WHERE 1=1 ';

            if (excludeId) sql_string += ' AND points.id <> ' + excludeId;


            if (onlyPeople) {
                sql_string += ' AND (points.name IS NOT NULL AND points.date > (NOW() - INTERVAL ' + geolocationSpeed * 10 + ' SECOND) ) ';

            } else {
                // sql_string += ' AND  (points.name IS NULL OR points.name IS NOT NULL AND points.date > (NOW() - INTERVAL ' + geolocationSpeed * 10 + ' SECOND) )  '; // go get all points, including people.
                sql_string += ' AND points.name IS NULL '; // go get all unique points that are not people.
            }


            // sql_string += ' AND points.trackId = tracks.id ';
            // sql_string += ' AND tracks.songId = songs.id ';
            // sql_string += ' AND songs.medleyId = medleys.id ';
            // sql_string += ' AND medleys.albumId = albums.id ';
            sql_string += ' HAVING distance < ' + radius;
            sql_string += ' ORDER BY distance ';
            if (limit) sql_string += ' LIMIT ' + limit + ' ';
            return sql_string;
        }






		// kick it all off
		_findPoint();


	}



    Point.remoteMethod(
        'near',
        {
            http: { path: '/near/:lat/:lng', verb: 'get' },
            accepts: [
                { arg: 'lat', type: 'number' },
                { arg: 'lng', type: 'number' },
                { arg: 'radius', type: 'number' },
                { arg: 'max', type: 'number' },
                { arg: 'excludeId', type: 'number' },
                { arg: 'medleyId', type: 'number' },
                { arg: 'people', type: 'boolean' }
            ],
            returns: [
                { root: true }
            ]
        }
    );


    Point.remoteMethod(
        'time',
        {
            http: { path: '/time', verb: 'get' },
            returns: [
                { root: true }
            ]
        }
    );












};
