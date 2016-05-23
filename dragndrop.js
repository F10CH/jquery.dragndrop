var jQuery; if(!jQuery) throw "requires jQuery";

var DragNDrop = {
	version:'0.1b',
	isAdvancedUpload: function(){
	  var div = document.createElement('div');
	  return (('draggable' in div) || ('ondragstart' in div && 'ondrop' in div)) && 'FormData' in window && 'FileReader' in window;
	}()
};

$.fn.Draggable = function(options){
	if(!options) options = {};
	return this
		.attr('draggable','true')
		.on('dragstart',function(evt){
			$(this).data('drag.opt', options);
			if(options.ondrag instanceof Function) options.ondrag.call(this, evt);
		});
};

$.fn.Dropable = function(ondrop, ondragover, options){
	this.removeAttr('draggable')
		.attr('dropable','true')
		.off('.dnd')
		.on('drop.dnd', function(evt){
			if(ondrop instanceof Function) ondrop.call(this, evt);
			evt.preventDefault();
		})
		.on('dragover.dnd',function(evt){
			if(ondragover instanceof Function) ondragover.call(this, evt)
			evt.preventDefault();
		})
	return this;
};

$.fn.Dropzone = function(options){
	options = options || {};
	var files = [];
	var container = $(options.container);
	if(container.length == 0) container = this;

	var self = this.Dropable(function(evt){
		try{
			if(!options.append) files = [];
			self.addFile(Array.from(evt.originalEvent.dataTransfer.files));
		}
		catch(ex){
			if(options.error instanceof Function) options.error.call(self,ex);
		}
		evt.preventDefault();
		evt.stopPropagation();
		return false;
	})
		.on('dragenter.dnd',function(evt){
			container.addClass('drag');
		})
		.on('dragleave.dnd dragend.dnd',function(evt){
			container.removeClass('drag');
		});

	if(options.fileInput){
		self.addClass('clickable');
		$(options.fileInput).off('change.dnd').on('change.dnd',function(){
			self.addFile(this.files);
		});
		self.off('click.dnd').on('click.dnd',function(evt){
			$(options.fileInput).click();

			return false;
		});
	}

	var welcomeElement = $(options.welcome || $('>div',container).not('[value]').eq(0));
	//welcomeElement.siblings().remove();

	var fileIndex = function(name){
		return files.map(function(e){ return e.name }).indexOf(name);
	};

	var refresh = function(){
		var gen = options.htmlGenerator || function(f){ return '<div value="'+f.name+'"><span class="removable" style="cursor:pointer">'+f.name+'</span></div>'; };
		$('>div[value]',container).remove();
		for(var f of files){
			container.append(gen(f));
		}
		attachClick();
		var rows = $('>div[value]',container);
		if(options.toggleFilled instanceof Function) options.toggleFilled.call(self,rows.length>0);
		else welcomeElement.toggle(rows.length==0);
		container.toggleClass('filled',rows.length>0);
		if(rows.length>0) container.removeClass('drag');
	};

	var attachClick = function(){
		$('.removable', container).off('click.dnd').on('click.dnd',function(evt){
			var div = $('div[value]', container).has(this);
			if(div.length==0) div = $(this);
			var name = div.attr('value') || div.text();
			self.removeFile([name]);
			evt.stopPropagation();
			return false;
		});
	};

	self.getFiles = function(){
		return files;
	};

	self.totalSize = function(){
		var size = 0;

		for(var f of files){
			size += f.size;
		}
		return size;
	};

	self.get = function(exp){
		return files.map(function(e,i){
		  var match = e.name.match(exp);
		  return match ? [e,i] : null;
		}).filter(function(e){ return !!e });
	};

	self.addFile = function(added, filter){
		var filtered = [];
		for(var f of added){
			var ret = {};
			if(
				(options.filter instanceof Function && !options.filter.call(self,f,ret)) ||
				(filter instanceof Function && !filter.call(self,f,ret))
			){
				$(this).trigger('rejected',[f,added,ret]);
				continue;
			}
			var i = 0;
			if(fileIndex(f.name)>=0){
				files.splice(i,1);
			}
			filtered.push(f);
			files.push(f);
		}

		refresh();
		self.data('files',files);
		$(this).trigger('fileadded',[files, filtered]);
		if(options.fileAdded instanceof Function) options.fileAdded.call(self, files, filtered);
		return filtered;
	};

	self.removeFile = function(names, filter){
		var removed = [];
		try{
			for(var n of names){
				var i = fileIndex(n);
				if(i<0) continue;
				if(filter instanceof Function && !filter.call(self,files[i],i)) continue;
				removed.push(files[i]);
				delete files[i];
				files.splice(i,1);
			}
			if(removed.length > 0){
				self.trigger('fileremoved',[removed]);
				if(options.fileRemoved instanceof Function) options.fileRemoved.call(self, removed);
				refresh();
			}
			self.data('files',files);

		}
		catch(ex){
			if(options.error instanceof Function) options.error.call(self,ex);
		}
		return removed;
	};

	container.addClass('dropzone');

	refresh();
	return self;
};

DragNDrop.FileUpload = function(formOrFormData, dropzoneSelector, options){
	this.options = options || {};
	var self = this;
	var files = [];

	var form = null;
	if(!(formOrFormData instanceof FormData)){
		form = $(formOrFormData).filter('form').get(0) || $('form').has(formOrFormData).get(0);
		if(form instanceof HTMLFormElement) formOrFormData = new FormData(form);
		else formOrFormData = null;
	}

	this.dropzone = $(dropzoneSelector);

	this.submit = function(options, ajaxOptions){
		options = $.extend(self.options, options || {});
		var formData = formOrFormData;
		if(!formData) return null;

		if(this.dropzone instanceof jQuery) this.dropzone.each(function(){
			var files = $(this).data('files') || [];
			var key = options.field || $(this).attr('name') || 'files[]';
			formData.delete(key);
			for(var i=0; i<files.length; i++){
				formData.append(key, files[i]);
			}
		});

		var extra = $.extend(self.options.extra || {}, options.extra || {});
		for(var k in extra){
			formData.append(k, extra[k]);
		}
		var ajaxParams = $.extend(ajaxOptions || {}, {
				url: options.action || (form?form.getAttribute('action'):null) || '?',
	    		type:  options.method || (form?form.getAttribute('method'):null) || 'POST',
	    		dataType: options.dataType || 'json',
	    		data: formData,
	    		xhr: function () {
			        var xhr = $.ajaxSettings.xhr();
			        xhr.upload.onprogress = function (e) {
			        	if(e.lengthComputable){
			        		$(self).trigger('uploading',[e.loaded,e.total]);
			        		if(options.uploading instanceof Function) options.uploading.call(self,e.loaded,e.total);
			        	}
			        };
			        return xhr;
			    },
	    		cache: false,
	    		contentType: options.contentType  || /*(form?form.getAttribute('enctype'):null) ||*/ false,
	    		processData: options.processData || false,
	    		complete: options.complete || null,
	    		success: options.success || null,
	    		error: options.error || null,
	    		beforeSend: options.beforeSend || null,
			});

		var jqxhr = $.ajax(ajaxParams);
		return jqxhr;
	}
};

$.fn.DropableUploadForm = function(dropzoneSelector, options){
	var self = this.filter('form');
	var manager = new DragNDrop.FileUpload(self, dropzoneSelector, options);

	self.data('uploadManager',manager);
	manager.options.error = function(){ self.trigger('uploadError'); };
	manager.options.success = function(data){  self.trigger('uploaded',[data]); };
	manager.options.uploading = function(n,total){  self.trigger('uploading',[n,total]); };
	if(!manager.options.extra) manager.options.extra = {};

	self.upload = function(){
		self.trigger('uploadStart',[manager]);
		manager.submit();
		return self;
	};

	self.set = function(key,value){
		if(value == undefined) delete manager.options.extra[key];
		else manager.options.extra[key] = value;
		return self;
	};
	//this.uploadManager = manager;
	return self;
};