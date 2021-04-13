+++
author = "Andrea Simone Costa"
title = "JavaScript Iterators and Generators: Asynchronous Generators"
date = "2019-09-15"
description = "All you should need to know about JavaScript Asynchronous Generators."
categories = ["javascript"]
series = ["JavaScript Iterators and Generators"]
tags = [
    "asynchronous",
    "generators",
    "nodejs",
]
featuredImage = "/images/jsitgen/4.png"
+++

__Series__: [JavaScript Iterators and Generators](/series/javascript-iterators-and-generators/)

# Introduction

Here we are! It's time for __Asynchronous Generators__!
Are you excited? I am excited 😃.

This kinda exotic type of __function__ was added to the language at the same time as async iterators were, and it answers the question: __how async functions and generators should compose?__
If you think about it, async generators are still __generators__, so there shouldn't be a lot of both conceptual and concrete (in their usage) differences with the sync counterpart. But async generators are __async functions__ too, so the `await` keywords can be used inside them.
That's why the previous question can be reworded as follows: how can the `yield` keyword work in conjunction with the `await` keyword?
&nbsp;

# Asynchronous Generators

The answer involves state machines and queues, plus a clever algorithm that is damn well explained [here](https://exploringjs.com/es2018-es2019/ch_asynchronous-iteration.html#async-generators).
Trying to summarize and simplify, each time then __next__/__throw__/__return__ method is called, a __Promise__ is immediately returned and the call itself is enqueued. The async generator instance can be in two states: __PAUSED__ or __RUNNING__. The _PAUSED_ state means that the instance was waiting to start or was paused on a `yield`. In such a case, the call just enqueued will __resume__ the generator and the next yielded value, or the next thrown error, will be used to fulfil, or reject, the _Promise_ previously returned from that call.
But the generator could be in the _RUNNING_ state, and this means that it is _awaiting_ some async operation. Therefore it is still handling a previous __iteration's method__ call and the new one mustn't have any side effect on the generator instance's state. It should just be queued.
The circle is closed because each time a `yield` keyword is encountered, if there is at least one enqueued call, the generator won't _PAUSE_. The oldest enqueued call will be dequeued to be handled and the generator will continue with its flow.

Although it should be clear enough at this point, I want to stress that objects returned by __async generators__ implement the __AsyncIterator__ interface we saw in the last article. Therefore they are perfect to create __async iterables__.
Moreover, the implicit iteration's methods calls queue contrasting a possible high consumer pressure, the fact that all async iterators returned are async iterables as well (remember the `return this` convention) and, last but not least, the impossibility of returning a Promise as an iteration result's `value`, following the spec hints, are further excellent reasons for preferring async generators over a manual implementation of the async iteration interfaces.
&nbsp;

### Our first async generator

Let's revisit the `remotePostsAsyncIteratorsFactory` we built in the previous article. The code is self-explanatory enough:

```js
async function* remotePostsAsyncGenerator() {
    let i = 1;
    
    while(true) {

        const res = await fetch(`https://jsonplaceholder.typicode.com/posts/${i++}`)
                                .then(r => r.json());
        
        // when no more remote posts will be available,
        // it will break the infinite loop.
        // the async iteration will end
        if (Object.keys(res).length === 0)  { break; }

        yield res;
    }
}
```

The act of _yielding_ something we do not yet have could sound weird to you, but remember that a temporally ordered set of Promises is involved, which will be fulfilled only when data become available.
Surely you will have noticed the qualitative leap respect to the previous manual implementation of the async iteration interfaces. That's because although async generators seem scary and intimidating at first, they help us to write some very clear, compact and effective code, despite the considerable level of abstraction.
&nbsp;

### yield-on, await-off

Let's become more confident with the behaviour of these two keywords.

As we did before, you can wait for the completion of a Promise, to then _yield_ its fulfilment value:

```js
const asyncSource = {
    async *[Symbol.asyncIterator]() {
        const v = await new Promise(res => setTimeout(res, 1000, 1));
        yield v;
    }
}
```

You can do the same with only one line, like a true __pro__grammer:

```js
const asyncSource = {
    async *[Symbol.asyncIterator]() {
        yield await new Promise(res => setTimeout(res, 1000, 1));
    }
}
```

In this case, you can avoid using the `await` keyword at all! That's because,  when it comes to async iteration, an __IteratorResult__'s `value` should never be a Promise. Therefore, async generators won't let the Promise pass. __Each yielded Promise will be implicitly <i>awaited</i>__:

```js
const asyncSource = {
    async *[Symbol.asyncIterator]() {
        yield new Promise(res => setTimeout(res, 1000, 1));
    }
}
```

&nbsp;

Otherwise, if you plan to insert a Promise into the generator, using the __next__ method, you will have to manually `await` it:

```js
const asyncSource = {
    async *[Symbol.asyncIterator]() {
        // the good, old operators precedence...
        const nextArgument = await (yield ...);
    }
}
```

&nbsp;

The next script is a good test to know if you have understood how `await` and `yield` work together:

```js
const asyncSource = {
    async *[Symbol.asyncIterator]() {
            console.log(await new Promise(res => setTimeout(res, 1000, 1)));
            console.log(await new Promise(res => setTimeout(res, 2000, 2)));
            yield 42;
    }
}

const ait = asyncSource[Symbol.asyncIterator]();

ait.next().then(({value}) => console.log(value));
```

What will it log?

```
// 1
// 2
// 42
```

You could be tempted to think that, since the `42` is already known, it we'll be almost immediately returned. But this is not how async generators works: a Promise is instantly returned by the __next__ method, but its resolution is deferred until the first `yield` is encountered.
&nbsp;

Every other consideration we made about sync generators, like the behaviour of the `try-catch` block, generators delegation and so on, also apply to the async variant. Therefore, I chose to follow a DRY approach. Just keep in mind that async generators work in the __async realm__, so fulfilled or rejected Promises are used instead of spatial values and exceptions.
Be aware that the `yield*` keyword does support both async and sync iterables. It uses a conversion process similar to the one adopted by the `for-await-of`.
&nbsp;

### A more complex real-life example

The following is a possible approach for the case where a remote resource has a very strict limit on the number of requests, so we have to fetch more data with one request but we want to handle them in smaller chunks:

```js
// do you remember it?
function* chunkify(array, n) {
    yield array.slice(0, n);
    array.length > n && (yield* chunkify(array.slice(n), n));
}

async function* getRemoteData() {
    let hasMore = true;
    let page;

    while (hasMore) {
        const { next_page, results } =
            await fetch(URL, { params: { page } }).then(r => r.json());

        // return 5 elements with each iteration
        yield* chunkify(results, 5);

        hasMore = next_page != null;
        page = next_page;
    }
}
```

At each iteration, `getRemoteData` will return one chunk of the previously fetched array, thanks to the delegation to `chunkify`. Sometimes the generator will fetch another bunch of data from the remote source, sometimes it will not. There will be no differences from a consumer's point of view.

It's noteworthy that each __IteratorResult__ is strictly dependent on the previous ones. Each iteration could be the last: local to an array of results or global. Furthermore, to get the next bunch of data, we need the previous `next_page`.
It would be impossible to maintain consistency without the queuing logic of the async generators.
&nbsp;

# Generators Piping

There is a powerful pattern, conceptually similar to the _Unix piping_, based on the fact that each generator produces an iterator-iterable that can be iterated.

The overall idea is to combine multiple generators sequentially, like a __pipe__ combine multiple processes, feeding each generator with the values __yielded__ by the one which precedes it.
Because each generator is able to do whatever it wants with those values, many pretty interesting things can be done, both sync and async 😃. From simply logging them for debugging purposes, to completely transforming them. From yielding out only those that satisfy a given condition, to yield a composition of them.
Two compound generators are not required to _yield_ at the same frequency. Therefore the outer is able to iterate over the inner more than once before _yielding_ something. But it is equally capable of producing more than one value using only one chunk of data received from its source.
&nbsp;

### Synchronous piping

To better understand the idea, let's start doing something easy and sync. Let's say we have a collection of numbers and we want to multiply each one by `2`, to then subtract `1` and, finally, remove all non-multiples of `3`:

```js
function* multiplyByTwo(source) {
    for(const value of source) {
        yield value * 2;
    }
}

function* minusOne(source) {
    for(const value of source) {
        yield value - 1;
    }
}

function* isMultipleOfThree(source) {
    for(const value of source) {
        !(value%3) && (yield value);
    }
}

const collection = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

// here the piping
[...isMultipleOfThree(minusOne(multiplyByTwo(collection)))]; // [3, 9, 15]
```

There are some considerations to make.
The first concerns the high reusability, maintainability and extensibility of this approach. Each generator expects an iterable, that is an interface, so it knows nothing about its `source`. Furthermore, it produces another iterable, so it doesn't need to know anything about its consumer. You can compose these functions as you want, reusing them whenever you need.
The second is about memory efficiency: unlike arrays' methods such as `map`, `flatMap` and `filter`, there isn't a collection that is recreated from scratch at each step of the _pipeline_. Each value flows from the source to the end, or to the generator that will discard it. This is a remarkable resemblance to transducers.
&nbsp;

### Asynchronous piping

This is also applicable to the async realm thanks to async generators.
Let's consider a fairly widespread example, that is reading a file using Node.js streams, which are async iterables:

```js
// yaffee
(async function IIAFE() {
    const fileStream = new FileReaderByLines('test.txt');

    for await (const line of fileStream) {
        console.log('> ' + line);
    }
})();
```

We are creating an instance of the `FileReaderByLines` class, that we will examine shortly, to then asynchronously iterating over it thanks to the `for-await-of` loop.

Here it is the `FileReaderByLines` class:

```js
const fs = require('fs');

// transform chunks into lines
async function* chunksToLines(chunksSource) {
    
    let previous = '';

    for await (const chunk of chunksSource) {
        previous += chunk;
        let eolIndex;

        while ((eolIndex = previous.indexOf('\n')) >= 0) {
            const line = previous.slice(0, eolIndex + 1);

            yield line;
            
            previous = previous.slice(eolIndex + 1);
        }
    }

    if (previous.length > 0) {
        yield previous;
    }
}

class FileReaderByLines {
    constructor(file) {
        this.file = file;
    }
        
    [Symbol.asyncIterator]() {
        const readStream = fs.createReadStream(this.file, {
                encoding: 'utf8',
                highWaterMark: 1024
        });

        // PIPING
        // readStream produces an async iterable over chunks of the file
        // we feed 'chunksToLines' with it
        // 'chunksToLines' produces an async iterable that we return
        return chunksToLines(readStream); 
    }          
}
```

Let me explain what is happening.

The __@@asyncIterator__ method takes care of handling the data source, the file, using a readable stream. The call to `fs.createReadStream` method creates the stream by setting the file to read, the encoding used by the file and the maximum size of an internal buffer. The dimension of each chunk of data returned by the stream will be at most __1024 bytes__. The stream, when iterated, will return the content of the asynchronously filled buffer when it becomes available.

If the following `for-await-of` is used, the outcome would be the printing of the whole file, 1024 bytes at a time:

```js
for await (const buffer of readStream) {
    console.log(buffer);
}
```

Instead, we are using the __piping__ pattern to transform one, or more if necessary, 1024 bytes long chunk into lines. We compose the async iterable returned by `fs.createReadStream` with `chunksToLines`, an async generator that takes an async iterable and returns another one. The latter, at each async iteration, will return a line, not a chunk. It's noteworthy that most of the time the two async iterables produce values at a different frequency.

At the __IIAFE__ level we could choose, for some weird reason, to capitalize each line. We can easily do that by inserting another async generator into the pipeline:

```js
async function* capitalize(asyncSource) {
    for await (const string of asyncSource) {
        yield string[0].toUpperCase() + string.slice(1);
    }   
}

// yaffee
(async function IIAFE() {
    const fileStream = new FileReaderByLines('test.txt');

    for await (const line of capitalize(fileStream)) { // <-- here the PIPING
        console.log('> ' + line);
    }
})();
```

In this way, we are composing the async iterable `fileStream` with `capitalize`, another async generator that takes an async iterable and returns a fresh new one. The latter, at each async iteration, will return capitalized lines.

&nbsp;

# Conclusion

That's all folks!

We have learnt why we need __Asynchronous Generators__, how they work and how they can be used to build amazing things! Thanks to them, creating well-formed async iterables is a breeze.
We have also learnt about both sync and async __generators piping__, a powerful pattern that I'm sure will expand your horizons.

If you've enjoyed this journey through __JavaScript Iterators and Generators__, please help me share it to as many JS developers as possible 💪🏻😃.
And, as usual, I hope to see you again 🙂 and on [twitter](https://twitter.com/JFieldEffectT)!

&nbsp;

# Acknowledgements

I would like to thank [Nicolò Ribaudo](https://twitter.com/NicoloRibaudo) and [Marco Iamonte](https://github.com/briosheje) for the time spent helping me to improve the quality of the article.

&nbsp;

# Bibliography

* [ECMAScript 2019 specification](https://www.ecma-international.org/ecma-262/10.0/index.html)
* [Exploring JS](https://exploringjs.com/) series by Dr. Axel Rauschmayer
* [Reading streams via async iteration in Node.js](https://2ality.com/2018/04/async-iter-nodejs.html) by Dr. Axel Rauschmayer
* [General Theory of Reactivity](https://github.com/kriskowal/gtor) by Kris Kowal
* [Asynchronous Iterators for JavaScript](https://github.com/tc39/proposal-async-iteration) by TC39
