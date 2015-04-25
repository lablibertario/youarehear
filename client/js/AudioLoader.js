

function AudioLoader(context, point, callback) {

	this.context = context;
	this.onload = callback;
	this.point = point;
}

AudioLoader.prototype.loadBuffer = function(point) {
	// Load buffer asynchronously
	var request = new XMLHttpRequest();
    if (point.track_url) {
        request.open("GET", point.track_url, true);
        request.responseType = "arraybuffer";

        var loader = this;

        request.onload = function() {
            // Asynchronously decode the audio file data in request.response
            loader.context.decodeAudioData (

                request.response,

                function(buffer) {
                    if (!buffer) {
                        console.log('AudioLoader: Error decoding file data: ' + point.track_url);
                        return;
                    }
                    loader.onload(buffer, point.id);
                },

                function(error, x, c) {
                    console.error('AudioLoader: decodeAudioData error', error, x, c);
                }

            );
        }

        request.onerror = function() {
            console.log('AudioLoader: XHR error');
        }

        request.send();

    } else {
        //console.log(point);
    }
}

AudioLoader.prototype.load = function() {
	this.loadBuffer(this.point);
}

