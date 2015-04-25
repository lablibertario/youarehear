module.exports = function(Album) {



	Album.list = function(id, callback) {

		var result = function(err, album) {
			if (err) {
				console.log(err)
			} else {
				callback(null, album);
			}
		}

		Album.find({
			where: { id: id },
			include: {
				relation: 'medleys',
				scope: {
					include: {
						relation: 'songs',
						scope: { include: { relation: 'tracks' } }
					}
				}
			}
		}, result);
	}

	Album.remoteMethod(
		'list', 
		{
			http: { path: '/:id/list', verb: 'get' },
			accepts: [
				{ arg: 'id', type: 'number' },
			],
			returns: [
				{ root: true }
			]
		}
	);



};
