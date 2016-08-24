(function() {
var sidebarEl = document.getElementsByClassName('sidebar')[0];
var containerEl = sidebarEl.getElementsByClassName('container')[0];


/*****************************************************************************
 * Terminal and Shell Init
 *
 * The initlaization of terminal is intentionaly defered to the first time when
 * the logo button is clicked. The purpose is to make sure that all required
 * fonts are ready loaded as the terminal would use the dimensions of fonts
 * to determine the appropriate number of columns.
 ****************************************************************************/
var term, shell;
function terminalInit() {
    if (term) return;

    term = new tateterm.Terminal(containerEl, {
        cursorBlink: true,
        useStyle: true,
    });
    // set red color to the exactly the same red as we use
    term._term.colors[1] = '#e62e25';
    shell = new tateterm.Shell(term, {
        promptTemplate: '%s$ ',
        welcomeMsg: 'This is the tech blog of Tate Tian.\r\n' +
                    'To explore this website, use this terminal by clicking files or typing commands.'
    });

    var contentLoader = new ContentLoader();
    shell.on('loadurl', function(url) {
        // load the url specified by the <a> tag
        contentLoader.load(url);
        // hide terminal
        toggleTerm();
    });

    shell.init();
    shell.run('ls');
}

/*****************************************************************************
 * Terminal Open/Close Animation
 ****************************************************************************/

var sidebarOpen = false;
var btnEl = document.getElementsByClassName('logo-btn')[0];
var toggleTerm = function() {
    if (sidebarOpen) {
        sidebarEl.classList.remove('open');
        sidebarEl.classList.add('close');
        btnEl.classList.remove('clicked');
        sidebarOpen = false;
        document.body.style.overflow = "scroll";
    }
    else {
        terminalInit();

        document.body.style.overflow = "hidden";
        btnEl.classList.add('clicked');
        sidebarEl.classList.remove('close');
        sidebarEl.classList.add('open');
        sidebarOpen = true;
    }
};
btnEl.addEventListener('click', toggleTerm);

/*****************************************************************************
 * Logo Animation
 ****************************************************************************/

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

/*****************************************************************************
 * Content Loader
 ****************************************************************************/

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
        if (renderMath) renderMath();

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

})();
