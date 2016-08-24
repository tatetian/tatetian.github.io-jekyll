---
layout: post
title: A&#42; Algorithm Saves Me $1 Per Day!
---

![Screenshots of SolveThis+]({{ site.baseurl }}public/img/SolveThis/solvethis-screenshots.png "Screenshots of SolveThis+")

I love the puzzle. But I don't want to pay for its solutions!

[SolveThis+](https://itunes.apple.com/cn/app/solvethis+/id905858795) is a 
puzzle with a simple goal: move all blocks (white) to a destination 
(black-bordered) through obstacles (black), with restriction that all 
the blocks move together. 

This seemingly simple game is actually quite difficult for human players.
The "one day, one challenge" policy of SolveThis+ may give you a hint:
its creators must believe one challenge per day is enough for the appetite of a 
human brain. The game can be freely downloadable (on both Android and iOS), 
but it charges you one dollar for a solution!

Amazed by both the simplicity and difficulty of the game, I decided to write an 
AI that solves the game automatically. The result is
[SolveThis.js](https://github.com/tatetian/solvethis.js).

## A Demo
With SolveThis.js, you can solve the puzzle interactively or let the computer 
automatically find the solution with minimal steps. Try the [demo](https://jsfiddle.net/tatetian/bhsvauyq/1/) below.

<iframe width="100%" height="600" 
src="//jsfiddle.net/tatetian/bhsvauyq/1/embedded/result/" 
allowfullscreen="allowfullscreen" frameborder="0"></iframe>

## How it Works

### Best-first search

The puzzle of SolveThis+ resembles classic games, like reversi and chess, in 
the sense that a series of moves have to be made and at the time of each move 
one can't easily tell what is the best decision. All the combination of 
decisions at each move forms a tree-structured search space. (To simplify the 
discussion, I intentionally ignore the fact that the search space is actually 
a general directed graph rather than a tree.)

Depth-first and width-first are the two most common strategies to explore a tree.
But these simple, brute-force methods are infeasible due to the huge search space.
Fortunately, we have a third option: best-first search.

Best-first search explores a tree by expanding the most promising node chosen 
according to some evaluation function. If the evaluation function is clever 
enough, a best-first search can be far more efficient than a brute-force search 
by exploring the "fruitful" part of the search space first.

The following code demonstrates a best-first search implemented in JavaScript:
{% highlight javascript %}
function bestFirstSearch(initNode, goalNode, evalFunc) {
    // Maintains open nodes and its order
    var openNodes = new PriorityQueue();
    // Start searching from initNode
    initNode.val = evalFunc(initNode);
    openNodes.push(initNode);
    while(1) {
        // Examine the most promising node
        var node = openNodes.pop();
        
        // No solution found
        if (node == null) return null;
        // A solution found
        if (node == goalNode) return node.path();

        // Extend the search space
        var children = node.getChildren();
        for (var ci = 0; ci < children.length; ci++) {
            var newNode = children[ci];
            // Evaluate the `goodness` of a new node
            newNode.val = evalFunc(newNode);
            openNodes.push(newNode);
        }
    }
}
{% endhighlight %}

### Evaluation functions
A best-first search expands the most promising node at each round. By 'most 
promising', we mean the lowest expected total cost (i.e. steps in SolveThis+). 
Thus, given a partial solution (`node` in sample code below), the evaluation function returns 
an estimated total cost that consists of two parts--- the past cost (`p`) and the 
future cost (`f`)--- as shown below: 

{% highlight js %}
function evalFunc(node) {
    var p = ...; // Known cost: initNode --> node
    var f = ...; // Unknown cost: node --> goalNode 
    return p + f;
}
{% endhighlight %}

Interestingly, a depth-first search or width-first search can be seen as
a best-first search with a special evaluation function:

{% highlight js %}
// Eval func of depth-first search
function evalFuncDFS(node) {
    var p = - node.depth;
    var f = 0;
    return p + f;
}

// Eval func of width-first search
function evalFuncWFS(node) {
    var p = node.depth;
    var f = 0;
    return p + f;
}
{% endhighlight %}


### A&#42; algorithm
A&#42; algorithm is widely used in graph traversal for its optimality and 
efficiency. Despite some technical details, it is essentially a best-first 
search that employs an *admissible* heuristic, i.e.,

<strong>A&#42; algorithm = best-first search + admissible heuristic.</strong>

A heuristic refers to a technique that finds good enough solutions. The 
introduction of heuristic is used to evaluate the expected future cost of a 
partial solution. This is necessary as figuring out the exact future cost is 
too costly.

So what is an admissibile heuristic? An admissible heuristic is one that never 
overestimates the expected future cost of a node; that is to say, the cost 
estimated by an admissible heuristic is always smaller than the optimal. Thus, 
when a best-first search that employs an admissible heuristic finds a 
solution, we can be sure that the solution is optimal as all
possible solutions with smaller cost must have already been examined and ruled 
out.

A heuristic is the core of A&#42; algorithm; A&#42; algorithm only works as 
well as the heuristic it employs. So next we shall discuss the design of 
heuristics in SolveThis.js.

### The heuristics
Our starting point is the following observations:

* An admissible heuristic is to give a lower bound of (optimal) solutions, and
the greater the lower bound, the better;
* Given $$b$$ different lower bound functions $$f_1, f_2, \cdots, f_b$$, we can 
  use $$\max(f_1, f_2, \cdots, f_b)$$ as improved lower bound;
* One way to obtain a lower bound is to solve a simpler problem whose 
  solution is also one to the initial problem.

Inspired by these observations, I came up with a strategy that constructs
a series of simpler problems, and use the maximum of their lower bounds as the 
lower bound for the initial problem.

In order to construct the simpler problems, two more general definitions of 
original SolveThis+ problem are introduced:

*Definition of a $$k$$-block SolveThis+ problem of $$n$$ goals ($$k \le n$$).* 
On a board with $$k$$ blocks (and its initial positions), $$n$$ goal positions 
and some obstacles, find a way to move blocks through obstacles to any $$k$$ 
out of $$n$$ goal positions.

*Definition of a $$k$$-goal SolveThis+ problem of $$n$$ blocks ($$k \le n$$).* 
On a board with $$n$$ blocks (and its initial positions), $$k$$ goal positions 
and some obstacles, find a way to move any $$k$$ out of $$n$$ blocks through 
obstacles to goal positions.

To give a concrete example, consider a SolveThis+ problem as below (and for the 
convenience of illustration, a smaller board of size 4x4 is used):
![A simpler problem]({{ site.baseurl }}public/img/SolveThis/simpler-problem.png  "A simpler problem")

According to the definition, its $$1$$-block versions are: 
![A 1-block version of the simpler problem]({{ site.baseurl }}public/img/SolveThis/simpler-problem-1-block.png "A 1-block version of the simpler problem")
and its $$1$$-goal versions are: 
![A 1-goal version of the simpler problem]({{ site.baseurl }}public/img/SolveThis/simpler-problem-1-goal.png "A 1-goal version of the simpler problem")

Its $$2$$-block versions are: 
![A 2-block version of the simpler problem]({{ site.baseurl }}public/img/SolveThis/simpler-problem-2-block.png "A 2-block version of the simpler problem")
and its $$2$$-goal versions are: 
![A 2-goal version of the simpler problem]({{ site.baseurl }}public/img/SolveThis/simpler-problem-2-goal.png "A 2-goal version of the simpler problem")

And $$3$$-block and $$3$$-goal version is just the original problem itself.

In general, for a SolveThis+ problem of $$n$$ blocks, there are $$C_n^k$$ 
$$k$$-block (or $$k$$-goal) problems, each of which seems to take at least 
$$P_n^k$$ time to find a *decent* lower bound. For example, when $$k=1$$, the 
optimal solution can be obtained in $$O(n)$$-time if preprocessed using 
[Dijkstra's algorithm](http://en.wikipedia.org/wiki/Dijkstra%27s_algorithm). 
Although a simplified problem with a larger $$k$$ can be a better approximation
to the original problem, thus leading to a more accurate estimation, it takes 
much longer time. Therefore, to tradeoff between accuracy and execution time 
(as all heuristics do), the heuristics implemented in SolveThis.js only 
consider a fraction of $$k$$-block or $$k$$-goal problems, where $$k \le 4$$.


## Project
Interested in more implementation details or have an idea to improve the 
algorithm? Welcome to visit 
[SolveThis.js](https://github.com/tatetian/solvethis.js) on Github.

