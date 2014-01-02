/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, brackets, $, window, JSHINT*/
define(function (require, exports, module) {
    "use strict";

    var AppInit                 = brackets.getModule("utils/AppInit"),
        CodeInspection          = brackets.getModule("language/CodeInspection"),
        FileIndex               = brackets.getModule("filesystem/FileIndex"), 
        FileSystem              = brackets.getModule("filesystem/FileSystem"),
        ProjectManager          = brackets.getModule("project/ProjectManager"),
        DocumentManager         = brackets.getModule("document/DocumentManager"),
        defaultConfig = {
            "options": {"undef": true},
            "globals": {}
        },
        config = defaultConfig;

    require("jshint/jshint");
  
    /**
     * @private
     * @type {string}
     */
    var _configFileName = ".jshintrc",
        configured = false;

    function handleHinter(text,fullPath) {
        var resultJH = JSHINT(text, config.options, config.globals);

        if (!resultJH) {
            var errors = JSHINT.errors;
            var result = { errors: [] };
            for(var i=0, len=errors.length; i<len; i++) {
                var messageOb = errors[i];
                //encountered an issue when jshint returned a null err
                if(!messageOb) continue;
                //default
                var type = CodeInspection.Type.ERROR;
                if("type" in messageOb) {
                    if(messageOb.type === "error") {
                        type = CodeInspection.Type.ERROR;
                    } else if(messageOb.type === "warning") {
                        type = CodeInspection.Type.WARNING;
                    }
                }

                var message = messageOb.reason;
                if(messageOb.code) {
                    message+= " ("+messageOb.code+")";
                }

                result.errors.push({
                    pos: {line:messageOb.line-1, ch:messageOb.character},
                    message:message,
                    type:type
                });
            }
            return result;
        } else {
            return null;
        }
    }
    
    /**
     * Loads project-wide JSHint configuration.
     *
     * JSHint project file should be located at <Project Root>/.jshintrc. It
     * is loaded each time project is changed or the configuration file is
     * modified.
     * 
     * @return Promise to return JSHint configuration object.
     *
     * @see <a href="http://www.jshint.com/docs/options/">JSHint option
     * reference</a>.
     */
    function _loadProjectConfig() {

        var projectRootEntry = ProjectManager.getProjectRoot(),
            result = new $.Deferred(),
            file;
        
        if (configured) {
            result.resolve(config);
        } else {
            var c;
            file = FileSystem.getFileForPath(projectRootEntry.fullPath + _configFileName);
            file.read(function (err, content) {
                if (!err) {
                    var cfg = {};
                    try {
                        c = JSON.parse(content);
                    } catch (e) {
                        console.error("JSHint: error parsing " + file.fullPath + ". Details: " + e);
                        result.reject(e);
                        return;
                    }
                    cfg.globals = c.globals || {};
                    if ( c.globals ) { delete c.globals; }
                    cfg.options = c;
                    result.resolve(cfg);
                } else {
                    result.reject(err);
                }
            });
        }
        return result.promise();
    }
    
    function run(code, fullPath) {
        var response = new $.Deferred();
        
        _loadProjectConfig()
            .then(function(cfg) {
                config = cfg;
            })
            .fail(function() {
                config = defaultConfig;
            })
            .always(function() {
                var result = handleHinter(code, fullPath);
                response.resolve(result);
            });
        
        return response.promise();
        
    }
    
    CodeInspection.register("javascript", {
        name: "JSHint",
        scanFileAsync: run
    });

    AppInit.appReady(function () {

        $(DocumentManager)
            .on("documentSaved.jshint documentRefreshed.jshint", function (e, document) {
                // if this project's JSHint config has been updated, reload
                if (document.file.fullPath ===
                            ProjectManager.getProjectRoot().fullPath + _configFileName) {
                    configured = false;
                }
            });
        
    });

});
