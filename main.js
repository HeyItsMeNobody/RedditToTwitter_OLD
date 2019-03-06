const snoowrap = require('snoowrap');
const config = require('./config.json');
const fs = require('fs');
const twit = require('twit');
const request = require('request');
const shortid = require('shortid');

var log = function(text) {
    var date = new Date();
    console.log(`[${date.getTime()/1000}] ${text}`);
}

const r = new snoowrap({
    userAgent: config.reddit.userAgent,
    clientId: config.reddit.clientId,
    clientSecret: config.reddit.clientSecret,
    username: config.reddit.username,
    password: config.reddit.password
});

const t = new twit({
    consumer_key: config.twitter.consumer_key,
    consumer_secret: config.twitter.consumer_secret,
    access_token: config.twitter.access_token,
    access_token_secret: config.twitter.access_token_secret
});

var download = function(url, filename, callback) {
    request.head(url, function(err, res, body) {
        request(url).pipe(fs.createWriteStream(filename)).on('close', callback);
    });
}

setInterval(function(){
    var newPosts = r.getSubreddit(config.bot.subreddit).getNew();
    newPosts.forEach(post => {
        if (post.link_flair_text == 'Media' && post.url.includes("i.redd.it")) {
            var postedtxt = fs.readFileSync('./posted.txt', 'utf-8').toString();

            if (postedtxt.includes(post.url)) {
                log(`postedtxt includes ${post.url}`)
            } else {
                log(`postedtxt does not include ${post.url}`)
                fs.appendFile('posted.txt', post.url + `\n`, function (err) {
                    if (err) throw err;
                    log(`saved ${post.url}`)
                });

                var toPost = `${post.title} | https://redd.it/${post.id}/`;
                if (toPost.includes('[Media]')) {
                    toPost = toPost.replace('[Media] ', "");
                }

                var filename = shortid.generate();
                download(post.url, filename, function() {
                    log('Done downloading image from ' + post.url);

                    var b64content = fs.readFileSync(filename, { encoding: 'base64' });

                    t.post('media/upload', { media_data: b64content }, function(err, data, response) {
                        if (err) throw err;
                        var mediaIdStr = data.media_id_string;
                        var meta_params = { media_id: mediaIdStr, alt_text: { text: toPost } };
                        t.post('media/metadata/create', meta_params, function(err, data, response) {
                            if (err) throw err;
                            var params = { status: toPost, media_ids: [mediaIdStr] };
                            t.post('statuses/update', params, function (err, data, response){
                                if (err) throw err;
                                log(`Posted ${post.url} to twitter`);
                                fs.unlinkSync(`./${filename}`);
                                log(`Deleted ${post.url} from files`);
                            });
                        });
                    });
                });

            }
        }
    });

}, config.bot.msToWait);