module.exports = function(grunt) {

    var global = {}; // we need this to store some variables and pass them around, mostly the array counter and the array of subdirs to build.
    var path = require('path'); // node module for parsing paths
 

    grunt.initConfig({

        // global variables: 
        global: global, // expose the global variable to grunt tasks
        vars: grunt.file.readJSON('config.json'), // go get our config. Lots of important variables are stored there!
        pkg: grunt.file.readJSON('package.json'), // go get our config. Lots of important variables are stored there!

        
        // here are the actual build tasks. They contain variables set down in the default task registration. 
        sass: { // If called alone, this one will complie your css directory for you. Otherwise it builds the css when the default task is run.                                                                                         
            default: {
                files: [{
                   expand: true,
                   cwd: '<%= vars.assetsDirectory %>/',
                   src: ['**/*.scss', '<%= vars.assetsDirectory %>scss'],
                   dest: '<%= vars.assetsDirectory %>',
                   ext: '.css'
                }]
        	}
        },

        compass: { // If called alone, this one will complie your css directory for you. Otherwise it builds the css when the default task is run.                                                                                         
            default: {
				options: {
					config: 'config.rb'
				}
            }
        },

        watch: { // Run compass!                                                                                         
            compass: {
                files: ['<%= vars.assetsDirectory %>**/*.scss'],
                tasks: ['compass'],
                options: {
                    spawn: false
                }
            }
        },

        'external-file-list': { // parse the html for token blocks; cat those files together; write out the html with tokens replaced to the dist directory.
            default: {
                options: {
                    output_name: '<%= vars.destinationDirectory %>/tmp' // this will be used for .js and .css file generation
                },
                files: [{
                    expand: true,
                    cwd: '<%= vars.htmlDirectory %>/',
                    src: ['**/*.php'],
                    dest: '<%= vars.destinationHTMLDirectory %>',
                    ext: '.php'
                }]
            }
        },

        uglify: { // minify js -- pulls the files created in 'external-file-list'
            default: {
                files: [ { '<%= vars.destinationDirectory %>/js/<%= global.output_name %>.min.js': '<%= vars.destinationDirectory %>/**/tmp.js' } ]
            }
        },

        cssmin: { // minify css -- pulls the files created in 'external-file-list'
            default: {
                files: [ { '<%= vars.destinationDirectory %>/css/<%= global.output_name %>.min.css': '<%= vars.destinationDirectory %>/**/tmp.css' } ]
            }
        },

        copy: { // copy specific directories
            default: {
                files: [
                    //{ '<%= vars.destinationDirectory %>/img': '<%= vars.assetsDirectory %>/img/**/*' },
                    { expand: true, cwd: '<%= vars.assetsDirectory %>/img',  src: ['**/*'], dest: '<%= vars.destinationDirectory %>/img' },
                    { expand: true, cwd: '<%= vars.assetsDirectory %>/includes',  src: ['**/*'], dest: '<%= vars.destinationDirectory %>/includes' }
                ]
            }
        },

        clean: { // remove all our tmp files, wherever they are.
            dist: { src: '<%= vars.destinationDirectory %>/' },
            tmpfiles: {
                src: ["<%= vars.destinationDirectory %>/**/tmp.*", "<%= vars.assetsDirectory %>/**/tmp.*", "<%= vars.htmlDirectory %>/**/tmp.*"]
            }
        },

        'sftp-deploy': { // the user/pass info is stored in plaintext in the .ftppass file. This can be run interactively if that's deleted.
            default: {
                auth: {
                    host: '<%= vars[global.env + "FTPServer"] %>',
                    port: '<%= vars[global.env + "FTPPort"] %>',
                    authKey: '<%= global.env %>-authkey'
                },
                src: '<%= vars.destinationDirectory %>/',
                dest: '<%= vars[global.env + "FTPPath"] %>',
                exclusions: ['<%= vars.destinationDirectory %>/**/.DS_Store', '<%= vars.destinationDirectory %>/**/Thumbs.db', '<%= vars.destinationDirectory %>/**/.gitignore', '<%= vars.destinationDirectory %>/tmp']
            }
        },

        // Configure grunt-browser-sync
        browser_sync: {
            files: {
                src: [
                    'src/www/**/*.css',
                    'src/www/**/*.js',
                    'src/www/**/*.html',
                    'src/www/**/*.php',
                    'src/www/**/*.jpg',
                    'src/www/**/*.png',
                    'src/www/**/*.gif'
                ]
            },
            options: {
                watchTask: true,
                debugInfo: true,
                host: "localhost",
                proxy: "localhost:8081"
                //host: "localhost"
            }
        }


    });

    // Load plugins
    require('matchdep').filterDev('grunt-*').forEach(grunt.loadNpmTasks);


    grunt.registerTask('server', ['browser_sync', 'watch']);


    // Default task. usage: grunt [--dir=ad-leak]
    grunt.registerTask('default', 'The main buid task will build all sub-directories. Usage: grunt [--dir=dirname --env=development||staging||production]', function() {
        // get rid of any existing dist directory & tmp files and start fresh.
        grunt.task.run('clean');

        // load in our JSON variables here  
        var vars = global.vars = grunt.file.readJSON('config.json');
        var pkg = grunt.file.readJSON('package.json');

        // here's where we set our dir array and start the counter at 0
        /*global.dir = [];
        global.count = 0;
*/
        // set the default build/deploy/purge environment
        global.env = grunt.option("env") ? grunt.option("env") : 'development';
        if (global.env != 'development' && global.env != 'staging' && global.env != 'production') grunt.fail.warn(global.env + ' is not a valid environment! Please choose development, staging, or production or leave env empty for development.');

        global.output_name = pkg.name + '_' + pkg.version;


        // loop through the html directory and pull out directory names to use as the basis for everything.
        /*dir_override = false;
        grunt.file.recurse(vars.htmlDirectory, function(abspath, rootdir, subdir, filename) {
            if (typeof subdir != 'undefined') {
                if (subdir.indexOf('/') < 0) { // main-level directory, capture the directory name
                    if (!grunt.option("dir")) {
                        var thisdir = { dir: subdir + '/', filename: pkg.name + '_' + subdir + '_' + pkg.version }
                        global.dir.push(thisdir); // building for all. Run the main task multiple times, changing the global.dir[i] each time!
                    } else if (grunt.option('dir') == subdir && !dir_override) {
                        var thisdir = { dir: grunt.option('dir') + '/', filename: pkg.name + '_' + grunt.option('dir') + '_' + pkg.version }
                        global.dir.push(thisdir); // building for all.
                        dir_override = true;
                    }
                }
            }
        });*/

        grunt.task.run([ 'external-file-list', 'uglify', 'cssmin', 'clean:tmpfiles', 'copy' ]);

        /*// this will run the build task global.dir.length times. The last task is update-counter, which allows us to use some flow control after the (asynchronous) tasks start processing sequentially, which will speed up concurrent tasks.
        for (var i in global.dir) { 
            grunt.log.writeln('queuing: ' + global.dir[i].dir);
            grunt.task.run([ 'external-file-list', 'uglify', 'cssmin', 'clean:tmpfiles', 'copy', 'update-counter' ]);
        }

        // ERROR CHECKING: if we're explicitly passed in a dir but it doesn't exist, fail out.
        if (global.dir.length == 0 && grunt.option("dir")) {
            grunt.fail.warn('target ' + grunt.option("dir") + ' does not exist!');
        }*/
    });
    
    // this is the main helper task, generally just called by default.
    grunt.registerTask('build', 'Just build, don\'t deploy', function() {
        grunt.task.run([ 'default' ]);
    });

    // Deploy task: build clean, deploy to ftp site, purge Akamai cache. usage: grunt deploy [--dir=ad-leak][--env=development||staging||production]
    grunt.registerTask('deploy', 'Build and deploy via ftp to Akamai. Usage: grunt deploy [--dir=dirname]', function() {
        grunt.task.run([ 'default', 'sftp-deploy' ]);
    });


    // Purge task. usage: grunt purge
    grunt.registerTask('purge', 'Make an Akamai purge request for the main web directory listed in vars.json. Usage: grunt purge', function() {

        var https = require('https');
        var done = this.async(); // run this async to wait for the response.

        // need to load in our variables here, as this runs before grunt.initConfig and we can't access its objects directly.
        var vars = grunt.file.readJSON('config.json');

        if (typeof global.env == 'undefined') {
            global.env = grunt.option("env") ? grunt.option("env") : 'production';
        }

        // this is our master Akamai purge list.
        global.purge_list = [];

        // run through dist directory and build an actual specific hard-linked purge list of files
        grunt.file.recurse(vars.destinationDirectory, function(abspath, rootdir, subdir, filename) {
            if (typeof subdir != 'undefined') {
                global.purge_list.push('http:' + vars[global.env + 'WebPath'] + '/' + abspath.substring(vars.destinationDirectory.length, abspath.length));
            }
        });

        grunt.log.writeln ('PURGE LIST: '); for (var b in global.purge_list) { grunt.log.writeln ( global.purge_list[b]) }

        // set up the Akamai request
        var post_data = JSON.stringify({
            "type": "arl",
            "domain": global.env,
            "action": "remove",
            "objects": global.purge_list
        });

        //grunt.log.writeln('post_data:'); grunt.log.writeln(post_data);
        var options = {
            hostname: 'api.ccu.akamai.com',
            port: 443,
            path: '/ccu/v2/queues/default',
            method: 'POST',
            auth: vars.akamaiUser + ':' + vars.akamaiPassword,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': post_data.length
            }
        };

        var req = https.request(options, function(res) {
            var body = '';
            res.on('data', function(d) { body += d; });
            res.on('end', function () {
                if (body.indexOf('"httpStatus": 20') > -1) {
                    grunt.log.writeln('AKAMAI RESPONSE: Purge request accepted.');
                } else {
                    grunt.log.writeln('AKAMAI ERROR: Purge request failed!')
                    grunt.log.writeln(body);
                }
                done(); // this tells the async task to stop.
            });
        });

        // post the data
        req.write(post_data);
        req.end();

        req.on('error', function(e) {
            grunt.fail.warn(e);
        });

    });



    // These are tasks that you can't call directly, just helpers.

    // This task takes a list of php files as input. It parses the file for css and js tokens, reads those files, concatenates them, and copies them to the dist directory. Then it copies the php file to the dist directory after replacing the tokens in its content. and turns php directives into html comments. You can't call this directly as it depends on the update-counter flow control.
    // TODO: make this a plugin.
    grunt.registerMultiTask('external-file-list', 'INTERNAL TASK', function() {
        // process css files, store paths so each one is only used once overall
        var file_counter = 0; // make sure that we differentiate between different file css/js in the same html sub directory

        // initialize our file concatenation object for js and css content per html subdirectory
        global.file_list = {};
        global.file_list['js'] = [];
        global.file_list['css'] = [];

        var options = this.options({
            output_name: 'tmp' // default to something here in case they don't provide one
        });

        // iterate through the files.
        this.files.forEach(function(file) {
            var dest = file.dest;

            // for each input source file
            file.src.filter(function(filepath) {
                // check to see if it's an actual file
                if (!grunt.file.exists(filepath)) {
                    grunt.log.warn('Source file "' + filepath + '" not found.');
                    return false;
                } else {
                    // need to load in our variables here, as this runs before grunt.initConfig and we can't access its objects directly.
                    var vars = global.vars;

                    // this variable moves us down to the file's context so we can apply relative paths (i.e. '../../'); we'll use the node.js 'path' module to normalize these later
                    var cwd = filepath.substring(0, filepath.lastIndexOf("/")) + '/';

                    // grab a copy of the css and js references from the php input file
                    var contents = grunt.file.read(filepath);

                    var ft = ['js', 'css']; // the array of file types we'll process, since we're processing them in almost exactly the same way.

                    for (var c in ft) { // loop over the file types we just defined
                        var filetype = ft[c]; // this will be 'js' or 'css'

                        // these tokens have to match what's in the html file replace block
                        var token_start = '<!-- build:' + filetype + ' -->';
                        var token_end = '<!-- endbuild:' + filetype + ' -->';

                        // if we have a start token and the end token is after it
                        var cre = new RegExp(token_start + '([\\s\\S]*)' + token_end ,"mig");
                        contents = contents.replace(cre, function(match, block, offset, string) {
                            // find script tags
                            block = block.replace(/(<script.*?src[\s\S]?=[\s\S]?["|'])(.*)(["|'].*?>)/mig, function(match, p1, p2, p3) { processToken(cwd, p2, filetype); return p1+p2+p3; });

                            // find css link rel files
                            block = block.replace(/(<link.*?rel[\s\S]?=[\s\S]?["|'])(.*)(["|'])/mig, function(match, p1, p2, p3) { processToken(cwd, p2, filetype); return p1+p2+p3; });

                            // find css import files
                            block = block.replace(/(@import)\s+?(url.*?\()["|']?(.*?)["|']?(\));/mig, function(match, p1, p2, p3) { processToken(cwd, p3, filetype); return p1+p2+p3; });


                            // rewrite the tokenized code block to point to our single style
                            var csstokenizer = '<style>@import url("' + vars[global.env + "WebPath"] + '/css/' + global.output_name + '.min.css");</style>';
                            var jstokenizer = '<script type="text/javascript" async src="' + vars[global.env + "WebPath"] + '/js/' + global.output_name + '.min.js"></script>';
                            return filetype == 'js' ? jstokenizer : csstokenizer;
                        });

                    } // end for (var ft in filetypes) {

                    // change php directives into html comments.
                    //contents = contents.replace(/<\?[=|php]?([\s\S]*?)\?>/mig, "<!-- $1 -->");

                    // copy any images linked in the files to its dist directory if those images exist, and rewrite to a fully-qualified path. If not, leave it alone.
                    contents = contents.replace(/(<img[ ]*?src=["|'])(.*?)(["|'])/mig, function(match, p1, p2, p3) { return replacePath(p1, p2, p3, cwd); });
                    contents = contents.replace(/(<.*?data-config[\s\S]?=[\s\S]?["|'])(.*?)(["|'])/mig, function(match, p1, p2, p3) { return replacePath(p1, p2, p3, cwd); });
                    
                    // copy any static local html paths linked in the files to its dist directory if those html files exist, and rewrite to a fully-qualified path. If not, leave it alone.
                    contents = contents.replace(/(<a[ ]*?href=["|'])(.*?)(["|'])/mig, function(match, p1, p2, p3) { return replacePath(p1, p2, p3, cwd); });
                    
                    // copy references to images in css styles
                    //contents = contents.replace(/(url.*?\()["|']?(.*?)["|']?(\))/mig, function(match, p1, p2, p3) { return replacePath(p1, p2, p3, cwd); });
                    contents = contents.replace(/(url\()["|']?(.*?)["|']?(\))/mig, function(match, p1, p2, p3) { return replacePath(p1, p2, p3, cwd); });

                    // write out the html file to the passed-in dest
                    grunt.file.write(dest, contents);
                }

            });

        });

        // write out the final catted file for each filetype
        for (var filetype in global.file_list) {

            // set the tmp file name  // TODO: pass an option for tmp file name?
            var f_dest = grunt.template.process(options.output_name + '.' + filetype);
            
            // loop through our contents and concatenate them all together per file type
            catted_contents = '';
            for (var i in global.file_list[filetype]) {
                catted_contents +=  global.file_list[filetype][i];
            }

            // now write out that single master css or js file. It's got tmp in the file name so we'll deal with destroying it later after cssmin and uglify are finished with what we started here.
            if (catted_contents != '') grunt.file.write(f_dest, catted_contents);
        }

    });

    // helper task to increment the counter and iterate through the array of _pages directories for flow control.
   /* grunt.registerTask('update-counter', 'INTERNAL TASK', function() {
        global.count++;
    });*/






    // Helper functions, mostly for regexp procssing in external-file-list

    // This function normalizes a file path and after processing adds it to the file list for catting later
    function processToken (cwd, filepath, filetype) {
        var real_path = path.normalize(cwd + filepath);
        // parse files for url() paths and cwd them to new normalized paths relative to the current file BEFORE we cat it.
        if (grunt.file.exists(real_path)) {
            var cssjs_contents = grunt.file.read(real_path);
            // this regex looks for anything with a url() within the file contents.
            cssjs_contents = cssjs_contents.replace(/(url[ ]*?\()["|']?(.*?)["|']?(\))/mig, function(match, p1, p2, p3, offset, string) {
                return replacePath(p1, p2, p3, real_path.substring(0, real_path.lastIndexOf("/")) + '/');
            });
            global.file_list[filetype][real_path] = cssjs_contents;// store the file path as the array key so we only store it once; store the contents as its value so we can pull it out later.
        }
    }


    // This function will replace all paths in whatever it's given with updated paths based on a normalized cwd; it will also copy those files to dist if they exist.
    function replacePath (p1, p2, p3, cwd) {
        var vars = global.vars;
        var real_path = path.normalize(cwd + p2);
        if (grunt.file.exists(real_path)) {
            // copy the file to dist
            var file_dest;
            console.log('====================')
            console.log(p1, p2, p3, cwd)
            console.log(real_path)
            console.log('web path: ' + vars[global.env + "WebPath"])
            if (real_path.indexOf(vars.assetsDirectory) === 0) {
                console.log('desta: ', vars.destinationDirectory, real_path)
                file_dest = vars.destinationDirectory + real_path.substring(vars.assetsDirectory.length, real_path.length)
                ref_dest = vars[global.env + "WebPath"] + '/' + real_path.substring(vars.assetsDirectory.length, real_path.length)
            };
            if (real_path.indexOf(vars.htmlDirectory) === 0) {
                console.log('destb: ', vars.destinationDirectory, real_path)
                file_dest = vars.destinationHTMLDirectory + real_path.substring(vars.htmlDirectory.length, real_path.length)
                //ref_dest = vars[global.env + "WebPath"] + '/' + real_path.substring(vars.htmlDirectory.length, real_path.length)
                ref_dest = vars[global.env + "WebPath"] + '/' + vars.destinationHTMLDirectory.substring(vars.destinationDirectory.length, vars.destinationHTMLDirectory.length) + real_path.substring(vars.htmlDirectory.length, real_path.length)
            };
            console.log('desth: ', vars.destinationHTMLDirectory, ref_dest, file_dest)
            grunt.file.copy(real_path, file_dest); // TODO: if the file we're copying is a html file, recurse through and replace image and href paths
            return p1 + ref_dest + p3; // return the path name based on destination url // TODO: make the fully-qualified path rewrite an option, otherwise leave it alone.
        } else {
            return p1 + p2 + p3; // Invalid file. don't do anything, just return what we were given
        }

    }



};