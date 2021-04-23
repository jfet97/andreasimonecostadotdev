+++
author = "Andrea Simone Costa"
title = "Cloning JavaScript objects with graph theory"
date = "2021-03-20"
description = "Let's learn something about graph theory to properly clone JavaScript objects, both with and without circular references."
categories = ["javascript"]
tags = ["objects", "graphs", "graph theory"]
featuredImage = "/images/graphs/beee.jpg"
images = ["/images/graphs/beee.jpg"]
draft = true
+++

## Introduction

The JavaScript slang allow us to clone objects in more than one way. We can perform a shallow clone using `Object.assign` or the spread syntax and a deep clone thanks to the `JSON.parse(JSON.stringify())` trick.
Unfortunately, the last solution suffers from a problem: `JSON.stringify` cannot work on an object that has circular references, erroring out in such a case.

In this episode we'll learn a bit of graph theory to then use this knowledge to build a simple, but efficient, deep cloner.

&nbsp;

## Graphs

A graph is a mathematical structure made up by **vertices**, also called **nodes**, which are connected by **edges**. Here is an example:

{{< svg "/images/graphs/undir.svg" >}}

Graphs allow us to represent complex relationships between data. For example the nodes could stand for the cities of a country and the edges the roads that connect them.

There are two main kind of graphs: **undirected** graphs and **directed** graphs. The former ones, like the graph in the picture above, have edges without an orientation: edges are two-way streets.\
Conversely, directed ones are graphs where the edges have a direction associated with them:

{{< svg "/images/graphs/dir.svg" >}}

&nbsp;

## What do JavaScript objects have to do with graphs?

Let's say we have the following four objects:

```js
const foo = {
    _tag: "foo",
}

const bar = {
    _tag: "bar",
}

const baz = {
    _tag: "baz",
}

const qux = {
    _tag: "qux"
}
```

We can see them like four lonely nodes:

{{< svg "/images/graphs/4_alone.svg" >}}

But after having set up the following links between them:

```js
foo.bar = bar;

bar.baz = baz;

baz.qux = qux;

qux.bar = bar;
```

the graph starts to get some edges as well:

{{< svg "/images/graphs/4_not_alone.svg" >}}

In a graph like this there is a __directed edge__ from one node to another iff the source node is an object containing a _first-level reference_ to the object represented by the destination node. That is because we can immediately reach out the latter node from the former.\
In our example there is an edge from `foo` to `bar` because `foo` contains a direct reference to `bar`. On the contrary there is no reference that allow you to go from `bar` to `foo`, so there is not a reversed arrow.

&nbsp;

## Depth-First Search

One of the most famous algorithm for traversing a graph is the so called Depth-First Search. The algorithm starts at __one chosen node__ and explores as far as possible along each branch before backtracking. It is usually written recursively, but a simple iterative version can be obtained by using a __LIFO__ data structure, like a stack.\
We will discuss recursive implementation in JavaScript.

First let's have a look at the following helper functions that we'll be using throughout the article.

### isObject

```js
function isObject(entity) {
    return typeof entity === "object" && entity !== null;
}
```

Well you know, it's JavaScript. You can never be too sure eheh.

### getAdjacentNodes

```js
// an adjacent node is a node directly reachable by using a first-level reference
function getAdjacentNodes(obj) {
    return (
        Object.entries(obj)
        .filter(([, v]) => isObject(v))
    )
}
```

This function extracts out those we have defined as first-level references: all the `obj`'s first-level fields that are references to other objects.

### safePrint

```js
function safePrint(obj) {
    console.log(
        JSON.stringify(
            obj,
            function (key, value) {
                const isVObject = isObject(value);
                const isNode = isVObject && key === "";
                if(isNode || !isVObject) return value;
                else return key;
            },
            4
        )
    );
}
```

Understanding this function is not so important, feel free to skip it. Its purpose is providing a safe way to print the fist-level fields of objects that may have circular references.

&nbsp;

Now it's time for the depth first search!

```js
// it does the hard work, traversing the graph
function _DFS(node, visitedNodes) {

    // if we have already encountered this node
    // we can skip it
    if(visitedNodes.has(node)) {
        return;
    }

    // otherwise we print the current node
    safePrint(node);

    // then we set the node as visited
    visitedNodes.add(node, true);

    // now we recursively visit each adjacent node
    for (const [, n] of getAdjacentNodes(node)) {
        _DFS(n, visitedNodes);
    }

    // easy peasy
}

// the object 'obj' is the starting point for our faboulous graph trip
function DFS(obj) {
    return _DFS(obj, new Set());
}
```

Nothing so scary, right?\
It uses a `Set` to avoid re-analazying a node that has been already visited, so that the graph visit does end. That's because a graph can have cycles, that is a path that starts from a node and at the end returns to the node from which it has started. In the world of JavaScript objects it translates in the fact that there could be circular references. An object can even be self-referencing!

So if we have already visited a node we immediately return. Otherwise we print its first-level fields to then visit recursively its neighborhood. This is a DFS!

Obviously the output will be different based on the starting node. Calling the `DFS` function on `foo` will print:

```js
'{
    "_tag": "foo",
    "bar": "bar"
}'
'{
    "_tag": "bar",
    "baz": "baz"
}'
'{
    "_tag": "baz",
    "qux": "qux"
}'
'{
    "_tag": "qux",
    "bar": "bar"
}'
````

Instead, if we called it on `qux` we'll have:

```js
'{
    "_tag": "qux",
    "bar": "bar"
}'
'{
    "_tag": "bar",
    "baz": "baz"
}'
'{
    "_tag": "baz",
    "qux": "qux"
}'
```

It's not possible to reach out `foo` from `qux`, neither with a first-level reference nor with any path in the graph.
&nbsp;

## Object cloning

Here we are! Let's see how we can reuse what we have just learned about graph traversing. Our goal is to clone the object while we traverse the graph, but we cannot simply clone
all the properties as they are. That's because if a property is a reference to an object `X`, we have to set up a connection not to `X` but to the clone of `X`.\
To solve this problem we split the cloning operation of a object in two steps:

1. clone all the properties that are not reference to other objects
2. clone the adjacent objects setting up the references to the new objects

First let's introduce another function.

### cloneNonObjectProperties

```js
function cloneNonObjectProperties(obj) {
    return Object.fromEntries(
        Object.entries(obj).filter(([, v]) => !isObject(v))
    )
}
```

This function is exactly what we need to accomplish the first step. How does it work?

```js

{ a: 1, b: 2, c: {} }
|
v
Object.entries
|
v
[["a", 1], ["b", 2], ["c", {}]]
|
v
filter
|
v
[["a", 1], ["b", 2]]
|
v
Object.fromEntries
|
v
{ a: 1, b: 2 }

```

&nbsp;

Now it's time for the big boy!

```js
function cloneNode(obj, helperDict) {

    // if we have already encountered this node
    // we can just return its clone reference
    if(helperDict.has(obj)) {
        return helperDict.get(obj)
    }

    // otherwise we start by cloning non object properties
    const clonedNode = cloneNonObjectProperties(obj);

    // then we set the just cloned reference as the obj clone
    // to avoid reworks on it
    helperDict.set(obj, clonedNode)

    // now we recursively clone each object reachable by the current node
    for (const [k, n] of getAdjacentNodes(obj)) {
        const clonedAdjacentNode = cloneNode(n, helperDict);

        // we can set the new reference on the cloned obj
        clonedNode[k] = clonedAdjacentNode
    }

    return clonedNode;
}

function cloneGraph(obj) {
    return cloneNode(obj, new Map())
}
```

So if we have already visited a node we immediately return its clone. Otherwise we clone its primitive fields, to then clone recursively its neighborhood. After that we are able to set up the references to those new objects. Those references correspond to the ones that the original object had toward other objects.

The use of the `helperDict` is a fundamental piece of the puzzle: it both avoids to revisit already traversed nodes, like the `visitedNodes` `Set` in the `DFS` function did, and keeps track of the new objects corresponding to the original ones. It uses the objects of the old graph as keys and the already cloned objects as values.

In the recursive step we may recounter the object from which the trip has started: in such a case it's essential to already have a reference to its cloned counterpart, even if we know that it will be incomplete, in order to at least set up the new reference. Otherwise we would end up in an infinite recursion, in which to complete the cloning of an object `X` we must before complete the cloning of `X` itself. Furthermore, from the recursive call performed on the adjacent node `n` we expect the reference to the cloned version of `n`, so it is mandatory to always return the reference to the clone of the input node `obj`. That's why every time we encounter an object again we need to use the `helperDict` to retrieve its clone reference.

### Conclusion

That's all folks! Graphs are a very interesting and broad topic, I hope this article has teased you enough to delve into this wonderful side of the computer science!
