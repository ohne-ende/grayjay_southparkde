const PLATFORM = "PeerTube";

var config = {};

/**
 * Build a query
 * @param {{[key: string]: any}} params Query params
 * @returns {String} Query string
 */
function buildQuery(params) {
	let query = "";
	let first = true;
	for (const [key, value] of Object.entries(params)) {
		if (value) {
			if (first) {
				first = false;
			} else {
				query += "&";
			}

			query += `${key}=${value}`;
		}
	}

	return (query && query.length > 0) ? `?${query}` : ""; 
}

function getChannelPager(path, params, page) {
	log(`getChannelPager page=${page}`, params)

	const count = 20;
	const start = (page ?? 0) * count;
	params = { ... params, start, count }

	const url = `${plugin.config.constants.baseUrl}${path}`;
	const urlWithParams = `${url}${buildQuery(params)}`;
	log("GET " + urlWithParams);
	const res = http.GET(urlWithParams, {});

	if (res.code != 200) {
		log("Failed to get channels", res);
		return new ChannelPager([], false);
	}

	const obj = JSON.parse(res.body);

	return new PeerTubeChannelPager(obj.data.map(v => {
		return new PlatformAuthorLink(new PlatformID(PLATFORM, v.name, config.id), v.displayName, v.url, v.avatar ? `${plugin.config.constants.baseUrl}${v.avatar.path}` : "");

	}), obj.total > (start + count), path, params, page);
}

function getVideoPager(path, params, page) {
	log(`getVideoPager page=${page}`, params)

	const count = 20;
	const start = (page ?? 0) * count;
	params = { ... params, start, count }

	const url = `${plugin.config.constants.baseUrl}${path}`;
	const urlWithParams = `${url}${buildQuery(params)}`;
	log("GET " + urlWithParams);
	const res = http.GET(urlWithParams, {});

	if (res.code != 200) {
		log("Failed to get videos", res);
		return new VideoPager([], false);
	}

	const obj = JSON.parse(res.body);

	return new PeerTubeVideoPager(obj.data.map(v => {
		return new PlatformVideo({
			id: new PlatformID(PLATFORM, v.uuid, config.id),
			name: v.name ?? "",
			thumbnails: new Thumbnails([new Thumbnail(`${plugin.config.constants.baseUrl}${v.thumbnailPath}`, 0)]),
			author: new PlatformAuthorLink(new PlatformID(PLATFORM, v.channel.name, config.id), 
				v.channel.displayName, 
				v.channel.url,
				v.channel.avatar ? `${plugin.config.constants.baseUrl}${v.channel.avatar.path}` : ""),
			datetime: Math.round((new Date(v.publishedAt)).getTime() / 1000),
			duration: v.duration,
			viewCount: v.views,
			url: v.url,
			isLive: v.isLive
		});

	}), obj.total > (start + count), path, params, page);
}

function getCommentPager(path, params, page) {
	log(`getCommentPager page=${page}`, params)

	const count = 20;
	const start = (page ?? 0) * count;
	params = { ... params, start, count }

	const url = `${plugin.config.constants.baseUrl}${path}`;
	const urlWithParams = `${url}${buildQuery(params)}`;
	log("GET " + urlWithParams);
	const res = http.GET(urlWithParams, {});

	if (res.code != 200) {
		log("Failed to get comments", res);
		return new CommentPager([], false);
	}

	const obj = JSON.parse(res.body);

	return new PeerTubeCommentPager(obj.data.map(v => {
		return new Comment({
			contextUrl: url,
			author: new PlatformAuthorLink(new PlatformID(PLATFORM, v.account.name, config.id), v.account.displayName, `${plugin.config.constants.baseUrl}/api/v1/video-channels/${v.account.name}`, ""),
			message: v.text,
			rating: new RatingLikes(0),
			date: Math.round((new Date(v.createdAt)).getTime() / 1000),
			replyCount: v.totalReplies,
			context: { id: v.id }
		});
	}), obj.total > (start + count), path, params, page);
}

source.enable = function (conf) {
	config = conf ?? {};
};

source.getHome = function () {
	return getVideoPager('/api/v1/videos', {
		sort: "best"
	}, 0);
};

source.searchSuggestions = function(query) {
	return [];
};
source.getSearchCapabilities = () => {
	return {
		types: [Type.Feed.Mixed, Type.Feed.Streams, Type.Feed.Videos],
		sorts: [Type.Order.Chronological, "publishedAt"]
	};
};
source.search = function (query, type, order, filters) {
	let sort = order;
	if (sort === Type.Order.Chronological) {
		sort = "-publishedAt";
	}

	const params = {
		search: query,
		sort
	};

	if (type == Type.Feed.Streams) {
		params.isLive = true;
	} else if (type == Type.Feed.Videos) {
		params.isLive = false;
	}

	return getVideoPager('/api/v1/search/videos', params, 0);
};
source.searchChannels = function (query) {
	return getChannelPager('/api/v1/search/video-channels', {
		search: query
	}, 0);
};

source.isChannelUrl = function(url) {
	return url.startsWith(`${plugin.config.constants.baseUrl}/video-channels/`);
};
source.getChannel = function (url) {
	const tokens = url.split('/');
	const handle = tokens[tokens.length - 1];
	const urlWithParams = `${plugin.config.constants.baseUrl}/api/v1/video-channels/${handle}`;
	log("GET " + urlWithParams);
	const res = http.GET(urlWithParams, {});

	if (res.code != 200) {
		log("Failed to get channel", res);
		return null;
	}

	const obj = JSON.parse(res.body);

	return new PlatformChannel({
		id: new PlatformID(PLATFORM, obj.name, config.id),
		name: obj.displayName,
		thumbnail: obj.avatar ? `${plugin.config.constants.baseUrl}${obj.avatar.path}` : "",
		banner: null,
		subscribers: obj.followersCount,
		description: obj.description ?? "",
		url: obj.url,
		links: {}
	});
};
source.getChannelCapabilities = () => {
	return {
		types: [Type.Feed.Mixed, Type.Feed.Streams, Type.Feed.Videos],
		sorts: [Type.Order.Chronological, "publishedAt"]
	};
};
source.getChannelContents = function (url, type, order, filters) {
	let sort = order;
	if (sort === Type.Order.Chronological) {
		sort = "-publishedAt";
	}

	const params = {
		sort
	};

	if (type == Type.Feed.Streams) {
		params.isLive = true;
	} else if (type == Type.Feed.Videos) {
		params.isLive = false;
	}

	const tokens = url.split('/');
	const handle = tokens[tokens.length - 1];
	return getVideoPager(`/api/v1/video-channels/${handle}/videos`, params, 0);
};

source.isContentDetailsUrl = function(url) {
	return url.startsWith(`${plugin.config.constants.baseUrl}/videos/watch/`);
};

const supportedResolutions = {
	'1080p': { width: 1920, height: 1080 },
	'720p': { width: 1280, height: 720 },
	'480p': { width: 854, height: 480 },
	'360p': { width: 640, height: 360 },
	'144p': { width: 256, height: 144 }
};

source.getContentDetails = function (url) {
	const tokens = url.split('/');
	const handle = tokens[tokens.length - 1];
	const urlWithParams = `${plugin.config.constants.baseUrl}/api/v1/videos/${handle}`;
	log("GET " + urlWithParams);
	const res = http.GET(urlWithParams, {});

	if (res.code != 200) {
		log("Failed to get video detail", res);
		return null;
	}

	const obj = JSON.parse(res.body);
	const sources = [];

	for (const streamingPlaylist of obj.streamingPlaylists) {
		sources.push(new HLSSource({
			name: "HLS",
			url: streamingPlaylist.playlistUrl,
			duration: obj.duration ?? 0,
			priority: true
		}));

		for (const file of streamingPlaylist.files) {
			let supportedResolution;
			if (file.resolution.width && file.resolution.height) {
				supportedResolution = { width: file.resolution.width, height: file.resolution.height };
			} else {
				supportedResolution = supportedResolutions[file.resolution.label];
			}

			if (!supportedResolution) {
				continue;
			}

			sources.push(new VideoUrlSource({
				name: file.resolution.label,
				url: file.fileDownloadUrl,
				width: supportedResolution.width,
				height: supportedResolution.height,
				duration: obj.duration,
				container: "video/mp4"
			}));
		}
	}

	return new PlatformVideoDetails({
		id: new PlatformID(PLATFORM, obj.uuid, config.id),
		name: obj.name,
		thumbnails: new Thumbnails([new Thumbnail(`${plugin.config.constants.baseUrl}${obj.thumbnailPath}`, 0)]),
		author: new PlatformAuthorLink(new PlatformID(PLATFORM, obj.channel.name, config.id), 
			obj.channel.displayName, 
			obj.channel.url,
			obj.channel.avatar ? `${plugin.config.constants.baseUrl}${obj.channel.avatar.path}` : ""),
		datetime: Math.round((new Date(obj.publishedAt)).getTime() / 1000),
		duration: obj.duration,
		viewCount: obj.views,
		url: obj.url,
		isLive: obj.isLive,
		description: obj.description,
		video: new VideoSourceDescriptor(sources)
	});
};

source.getComments = function (url) {
	const tokens = url.split('/');
	const handle = tokens[tokens.length - 1];
	return getCommentPager(`/api/v1/videos/${handle}/comment-threads`, {}, 0);
}
source.getSubComments = function(comment) {
	return getCommentPager(`/api/v1/videos/${comment.context.id}/comment-threads`, {}, 0);
}

class PeerTubeVideoPager extends VideoPager {
	constructor(results, hasMore, path, params, page) {
		super(results, hasMore, { path, params, page });
	}
	
	nextPage() {
		return getVideoPager(this.context.path, this.context.params, (this.context.page ?? 0) + 1);
	}
}

class PeerTubeChannelPager extends ChannelPager {
	constructor(results, hasMore, path, params, page) {
		super(results, hasMore, { path, params, page });
	}
	
	nextPage() {
		return getChannelPager(this.context.path, this.context.params, (this.context.page ?? 0) + 1);
	}
}

class PeerTubeCommentPager extends CommentPager {
	constructor(results, hasMore, path, params, page) {
		super(results, hasMore, { path, params, page });
	}
	
	nextPage() {
		return getCommentPager(this.context.path, this.context.params, (this.context.page ?? 0) + 1);
	}
}