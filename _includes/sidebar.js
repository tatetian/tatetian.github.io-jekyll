(function() {
var sidebarEl = document.getElementsByClassName('sidebar')[0];
var containerEl = sidebarEl.getElementsByClassName('container')[0];

function getTermFitSize() {
    var viewportWidth = Math.max(document.documentElement.clientWidth,
                                 window.innerWidth || 0);
    // use 16px font when the width of viewport is smaller than 830px
    var charWidth = 11.4545;
    var lineHeight = 27;
    if (viewportWidth < 830) {
        charWidth *= (16.0/18);
        lineHeight *= (16.0/18);
    }

    var W = containerEl.clientWidth;
    var H = containerEl.clientHeight;
    var rows = Math.floor(H / lineHeight);
    var cols = Math.floor(W / charWidth);
    return {rows: rows, cols: cols};
}

var initTermSize = getTermFitSize();
var term = new tateterm.Terminal(containerEl, {
    cols: initTermSize.cols,
    rows: initTermSize.rows,
    useStyle: true,
});
// set red color to the exactly the same red as we use
term._term.colors[1] = '#e62e25';
var shell = new tateterm.Shell(term, {
    promptTemplate: '%s$ ',
    welcomeMsg: 'This is the tech blog of Tate Tian.\r\n' +
            'To explore this website, use this terminal by clicking files or typing commands.'
});

window.onresize = function() {
    var size = getTermFitSize();
    term.resize(size.cols, size.rows);
};

var shownWelcome = false;
var sidebarOpen = false;
var btnEl = document.getElementsByClassName('logo-btn')[0];
var toggleTerm = function() {
    if (sidebarOpen) {
        sidebarEl.classList.remove('open');
        sidebarEl.classList.add('close');
        btnEl.classList.remove('clicked');
        sidebarOpen = false;
    }
    else {
        // Run the terminal lazily util it is visible by user.
        // The reason is that resizing window may truncate welcome message.
        if (!shownWelcome) {
            shell.init();
            shell.run('ls');
            shownWelcome = true;
        }

        btnEl.classList.add('clicked');
        sidebarEl.classList.remove('close');
        sidebarEl.classList.add('open');
        sidebarOpen = true;
    }
};
btnEl.addEventListener('click', toggleTerm);

function now() {
    return (new Date).getTime() / 1000;
}

var logoEl = document.getElementsByClassName('logo')[0];
var rotateAngle = 0;
var lastRotateTime = 0;
var autoRotateTimer = null;
var autoRotatePeriod = 5000; // 5s
function rotateLogo(event) {
    if (event) event.stopPropagation();

    clearTimeout(autoRotateTimer);
    autoRotateTimer = setTimeout(rotateLogo, autoRotatePeriod);

    var isCloseBtn = btnEl.classList.contains("clicked");
    if (!isCloseBtn) {
        rotateAngle += 180;
        logoEl.style.transform = "rotateY(" + rotateAngle + "deg)";
    }
}
btnEl.addEventListener('mouseenter', rotateLogo);
btnEl.addEventListener('mouseleave', rotateLogo);
// Delay the first rotate a little bit in case the page is not fully loaded
setTimeout(rotateLogo, 1500);

function ContentLoader() {
    var self = this;
    self.preUrl = window.location.href;

    window.onpopstate = function(event) {
        var url = window.location.href;
        self.load(url, true);
    };
};

ContentLoader.prototype.getBaseUrl = function(url) {
    var baseUrlLen = url.indexOf("#");
    if (baseUrlLen < 0) baseUrlLen = url.length;
    var baseUrl = url.substr(0, baseUrlLen);
    return baseUrl;
}

ContentLoader.prototype.dontLoad = function(url) {
    window._preUrl = this.preUrl;
    window._url = url;
    return this.getBaseUrl(this.preUrl) == this.getBaseUrl(url);
}

ContentLoader.prototype.load = function(url, backHistory) {
    if (this.dontLoad(url)) return;

    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = "document";

    var self = this;
    xhr.onload = function () {
        // get the new content
        var resDoc = xhr.responseXML;
        var newPost = resDoc.getElementsByClassName('post')[0];

        // replace the old content with the new one
        var oldPost = document.getElementsByClassName('post')[0];
        var container = oldPost.parentNode;
        container.removeChild(oldPost);
        container.appendChild(newPost);

        // update title
        document.title = resDoc.title;

        window.scrollTo(0, 0);

        // manipulate the browser history
        if (!backHistory)
            window.history.pushState(null, "", url);

        self.preUrl = url;
    };

    xhr.send();
};

var contentLoader = new ContentLoader();
shell.on('loadurl', function(url) {
        // load the url specified by the <a> tag
        contentLoader.load(url);
        // hide terminal
        toggleTerm();
});

})();
