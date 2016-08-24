---
layout: page
title: Projects
---

A selection of projects that I have worked on is listed below.

## <a name="trustedssd">TrustedSSD: A Secure Solid-State Drive</a>
{% tags research project, data security, trusted hardware, C/C++, firmware, 
Linux kernel %}
![TrustedSSD]({{ site.baseurl }}public/img/about/OpenSSD.png)

- **Motivation.**  No existing data security solutions can provide a high security
guarantee for a large volume of data without considerable performance penalty. 
- **Core Idea.** Incooperating security mechanism into storage devices.
- **Contribution.** I developed *TrustedSSD*, a secure Solid State Drive (SSD) that
enforces a fine-grained access control to data in storage. The prototype is 
build upon a commerically-successful SSD controller (see the photo above). 
Experiments demonstrate the feasibility of the proposed in-storage security 
approach.

## <a name="trustedlibc">TrustedLibc: Libc for Hardware-Secured Containers</a>
{% tags research project, data security, trusted hardware, C/C++, Linux kernel %}

- **Motivation.** Recently, a new type of secure runtime container protected by commodity, 
trusted processors (e.g. [Intel SGX](https://software.intel.com/en-us/sgx)) 
has emerged as a promising technology to address security issues in cloud 
environment. However, in the secure containers, no privileged CPU instructions
(e.g. `SYSCALL`, `SYSENTER`) are permitted inside the secure containers.
- **Core Idea.** Building a libc with syscall support for the secure containers.
- **Contribution.** I developed *TrustedLibc*, a C standard library with a 
*secure* and *efficient* syscall mechanism, which enables unmodified C programs to 
run inside a secure container.

## <a name="huadingml">HuadingML: A Cloud Platform for Big Data Analytics</a>
{% tags lab project, machine learning, cloud computing, Apache Spark, Node.js %}
![Huading]({{ site.baseurl }}public/img/about/Huading.png)

- **Motivation.** Today, enterprises from all industries are seeking to 
convert their big data into big values. Current cloud offerings of big data 
tools are useful yet not satisfactory: to employees, the tools are not 
user-friendly to non-specialists; to employers, none of the tools give 
enough guarantee for data security.
- **Core Idea.** Machine learning by drag-and-drop; data security by trusted agents.
- **Contribution.** In this endeavour funded by our lab, I led a team of 10 
developers, architected the system, designed the RESTful APIs, drafted the 
user interface, and tackled most difficult technical issues (e.g. reduce 
the latency of jobs submitted to Apache Spark).

## <a name="paperclub">PaperClub: Social Network for Researchers</a>
{% tags startup project, HTML5, JavaScript, Ruby on Rails %}
![PaperClub]({{ site.baseurl }}public/img/about/PaperClub.png)

- **Motivation.** Doing research is lonely. Can we make a difference?
- **Core idea.** Share, read and discuss academic papers in group.
- **Lesson learned.** Out of my own frustration in doing research and inspired
the advice of [“solve your own problems"](http://paulgraham.com/startupideas.html) by Paul Graham,
I started the startup project and formed a team of four developers and one
designer.  Our initial development effort went well; we ranked top 3 in a 
hackathon and won the first price of an entrepreneurship program. 
Unfortunately, our web app didn’t take off in the end. In retrospect, I think
the root of our failure is [product-market mismatch](http://www.forbes.com/sites/xseedcapital/2014/06/25/how-to-survive-a-failed-product-plan-and-come-back-even-stronger).
I strongly recommend any entrepreneur to read the brilliant book 
[Running Lean](https://www.amazon.com/Running-Lean-Iterate-Works-OReilly/dp/1449305172),
which could have saved me from making the mistake in the first place.


## <a name="touchstarrynight">TouchStarryNight: Interactive Paintings</a>
{% tags art project, maker, Arduino, Java, Processing %}
![TouchStarryNight]({{ site.baseurl }}public/img/about/TouchStarryNight.png)

- **Motivation.** For humans, touch is the most natural and intuitive way to
interact with world. Yet, it is not until the introduction of revolutionary 
iPhone in 2007 that touchscren became a widely-used user-interface for digital 
devices. In this project, we want to put this even furthor: enable "touchscreen"
on non-digital objects.
- **Core Idea.** Enable audience to interact with the famous painting [The Starry Night by Vincent van Gogh](https://en.wikipedia.org/wiki/The_Starry_Night)
by touching on the canvas and receive visual and audio feedbacks in an 
immersive environment.
