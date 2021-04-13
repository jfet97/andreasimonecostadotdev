+++
author = "Andrea Simone Costa"
title = "JavaScript Iterators and Generators: Asynchronous Iterators"
date = "2019-09-08"
description = "All you should need to know about JavaScript Asynchronous Iterators."
categories = ["javascript"]
series = ["JavaScript Iterators and Generators"]
tags = [
    "asynchronous",
    "iterators",
]
featuredImage = "/images/jsitgen/3.png"
+++

__Series__: [JavaScript Iterators and Generators](/series/javascript-iterators-and-generators/)

# Introduction

Fresh news of the JavaScript language (we are talking about ES2018), __Asynchronous Iterators__, and the corresponding __Asynchronous Generators__, landed to solve a subtle, but important, problem.

We have seen that each iteration step performed with a synchronous iterator returns the `{done, value}` object, which is called __iterator result__, where the `done` field is a boolean flag indicating whether the end of the iteration has been reached. Therefore, they are perfect for __synchronous data sources__.
What is meant by synchronous source? They are data sources that, when receiving the request for the next element, are immediately able to determine whether that specific data will be the last available or not.

Pay attention to this detail: the source is synchronous, not the data, which can be synchronous or asynchronous.
Quick demonstration with an array of numbers and Promises:

```js
const array = [
    new Promise(res => setTimeout(res, 1000, 1)),
    new Promise(res => setTimeout(res, 2000, 2)),
    new Promise(res => setTimeout(res, 3000, 3)),
    new Promise(res => setTimeout(res, 4000, 4)),
    5,
    6,
    7,
    8,
]


;(async () => {

    for(const v of array) {
        console.log(await v); // 1 2 3 4 5 6 7 8
    }

})();
```

The array provides a synchronous iterator that is enough because, even if the returned value may be asynchronous, the collection is always able to determine synchronously (at the time of each request) its own state. Each time the __next__ method is implicitly called by the `for-of` loop, the source knows if the element it is going to return will be the last, so it is able to immediately set the `done` field.

Note that this is possible only if the collection is completely present in memory. But you will know better than me that it's common to have to interface with external data sources. They are usually represented by an entity that exposes an asynchronous API based on the concept of __event__ or, thanks to some layers of abstraction, with the concept of __stream__. Unfortunately, the synchronous iterators cannot be used to interface with them, because this type of iterator forces us to determine in a synchronous way the end of the iteration.
Those entities do not contain the data, perhaps they contain a small part but not all of it, because it is often not physically possible, so they are not able to know if the next data will be the last when it is requested.

This is where __asynchronous iteration__ comes into play, for which the resolution of the `done` flag is __asynchronous__.
&nbsp;

# Asynchronous Iteration

This type of iteration is based on __two__ new interfaces.
&nbsp;

### The AsyncIterable

The AsyncIterable interface defines what an entity has to implement to be considered an async iterable.
[The specification](https://www.ecma-international.org/ecma-262/10.0/index.html#sec-asynciterable-interface) says that the __@@asyncIterator__ method, which returns an object that implements the __AsyncIterator__ interface is required.
What is __@@asyncIterator__? Is a specific Symbol, like __@@iterator__ was, and we can find it into the Symbol constructor: __Symbol.asyncIterator__.

```js
const AsyncIterable = {
    [Symbol.asyncIterator]() {
        return AsyncIterator;
    }
}
```

&nbsp;

### The AsyncIterator

The big difference between an [__AsyncIterator__](https://www.ecma-international.org/ecma-262/10.0/index.html#sec-asynciterator-interface) and a sync one is what the three methods (__next__, __return__, __throw__) should return: a __Promise__. Their purpose basically remained the same.
Usually, both __next__ and __return__ methods should return a promise that is going to fulfil with an __IteratorResult__ object. On the contrary, the promise returned by the __throw__ method should be a rejected one, with the value passed as the argument being the rejecting reason.

```js
const AsyncIterator = {
    next() {
        return Promise.resolve(IteratorResult);
    },
    return() {
        return Promise.resolve(IteratorResult);
    },
    throw(e) {
        return Promise.reject(e);
    }
}
```

&nbsp;

### The IteratorResult

There isn't an async counterpart for this interface: the old __IteratorResult__ has everything we need to identify each iteration result. Indeed, we simply wrap it inside a Promise to be able to resolve the `done` flag asynchronously.
The only thing to keep in mind is a limitation which concerns the `value` field: it should never be neither a _promise_ nor a _thenable_. This approach would dangerously resemble a promise (the one returned by the __AsyncIterator__ methods) of a promise (the one inside the `value` field of the __IteratorResult__), a concept from which the JavaScript has always kept very far.
On the other hand, always finding a spatial value inside the fulfilled __IteratorResult__ will ensure greater temporal consistency between iterations.
&nbsp;

# Asynchronous Iterators

Let's implement an async iterators factory to iterate over a remote API:

```js
function remotePostsAsyncIteratorsFactory() {
    let i = 1;
    let done = false;

    const asyncIterableIterator = {
        // the next method will always return a Promise
        async next() {

            // do nothing if we went out-of-bounds
            if (done) {
                return Promise.resolve({
                    done: true,
                    value: undefined
                });
            }

            const res = await fetch(`https://jsonplaceholder.typicode.com/posts/${i++}`)
                                .then(r => r.json());

            // the posts source is ended
            if (Object.keys(res).length === 0) {
                done = true;
                return Promise.resolve({
                    done: true,
                    value: undefined
                });
            } else {
                return Promise.resolve({
                    done: false,
                    value: res
                });
            };

        },
        [Symbol.asyncIterator]() {
            return this;
        }
    }

    return asyncIterableIterator;
}
```

I'm sure that you aren't seeing anything you are not able to understand. The __next__ method will always return a Promise, as the interface wants. The Promise will be fulfilled after data fetching, thanks to which we are able to know when the iteration is over.
Note that I've added the __@@asyncIterator__ method to the returned iterator. And that's because all async iterators should be async iterables, following the example of their sync counterpart.

Let's use it:

```js
;(async() => {

    const ait = remotePostsAsyncIteratorsFactory();

    await ait.next(); // { done:false, value:{id: 1, ...} }
    await ait.next(); // { done:false, value:{id: 2, ...} }
    await ait.next(); // { done:false, value:{id: 3, ...} }
    // ...
    await ait.next(); // { done:false, value:{id: 100, ...} }
    await ait.next(); // { done:true, value:undefined }

})();
```

I think the code is sufficiently self-explanatory.
&nbsp;

### The for-await-of loop

The async counterpart of the `for-of` loop is the `fow-await-of` loop, which helps us a lot to iterate async sources without the need to manually handle each async __IterationResult__ nor the async end of the iteration.
It can be used only inside __async contexts__, like a _yaffee_, and is able to handle sync sources too. First of all, it will try to call the __@@asyncIterator__ method to get an async iterator to iterate, but it will fall back on the __@@iterator__ method when the source given to it is synchronous.

```js
;(async function IIAFE() {

    for await (const v of source) {
        console.log(v);
    }
    
})();
```

&nbsp;

Let's see some examples to learn how this loop behaves:

```js
    // sync source, sync values
    // each iteration will return '{ value:number|undefined, done:boolean }'
    for await (const v of [1, 2, 3, 4, ...]) {
        console.log(v); // 1 2 3 4 ...
    }

    // sync source, async values
    // each iteration will return '{ value:Promise<number>|undefined, done:boolean }'
    const array = [
        new Promise(res => setTimeout(res, 1000, 1)),
        new Promise(res => setTimeout(res, 2000, 2)),
        new Promise(res => setTimeout(res, 3000, 3)),
        new Promise(res => setTimeout(res, 4000, 4)),
        ...
    ]
    for await (const v of array) {
        console.log(v); // 1 2 3 4 ...
    }


    // async source, sync values
    // each iteration will return 'Promise<{ value:number|undefined, done:boolean }>'
    for await (const v of asyncSource) {
        console.log(v); // 1 2 3 4 ...
    }

    // async source, async values (BAD)
    // each iteration will return 'Promise<{ value:Promise<number|undefined>, done:boolean }>'
    for await (const v of asyncSource) {
        console.log(v); // series of Promises...
    }
```

Probably one or more results may sound strange to you, so let's try to make things clearer.
&nbsp;

#### Async sources

For async sources, the loop will just `await` each Promise returned by the implicit calls to the __next__ method. When the Promise is fulfilled, if the `done` flag is __false__, the loop will make the `value` available inside its body, whatever it is, to then proceed with the following iteration at its end.
No other operations will be performed on the `value` itself, and this explains why in the third example we see a series of numbers and in the fourth a series of Promises. Another good reason to not use Promises as values for async iterations! Instead, if the `done` flag is __true__, the loop will end.
&nbsp;

#### Sync sources

The behaviour of the `for-await-of` loop for sync sources is slightly different from what one might expect. You could think that each __IteratorResult__ object will be directly adapted, being inserted into an immediately fulfilled Promise, to eliminate any difference between sync and async iteration results. But, if this was the case, the outcome of the second example should be the same as the fourth one.

You are not very far from the truth, but things are slightly different. It's the sync __Iterator__ itself which is adapted thanks to the [__CreateAsyncFromSyncIterator__](https://www.ecma-international.org/ecma-262/10.0/index.html#sec-createasyncfromsynciterator) abstract operation. What happens is that each iterated __value__ is normalized into a Promise, via `Promise.resolve`, to then be _"awaited"_ to produce the __IteratorResult__.
We can outline what happens behind the scenes, at each iteration, in the following way, which I've derived from the [Dr. Axel one](https://exploringjs.com/es2018-es2019/ch_asynchronous-iteration.html#for-await-of-and-synchronous-iterables):

```js
// the for-await-of has just called 'adapter.next()' and is 'awaiting' the result

try {
    const syncIteratorResult = syncIterator.next();

    const nextIteratorResultPromise = Promise.resolve(syncIteratorResult.value)
        .then(value => ({ value, done: syncIteratorResult.done }));

    return nextIteratorResultPromise; // <-- this will be 'awaited' by the for-await-of
} catch(e) {
    // the loop is going to throw an exception if something goes wrong during the 'next' method call
    throw e;
}

```

Another great way to see what happens, which I'm going to borrow from Axel, is the following: `Iterable<T>` and `Iterable<Promise<T>>` become `AsyncIterable<T>`.
&nbsp;

### Node.js Streams

__Node.js Readable Streams__ are a more concrete example of async iterables. That is because they were built to support consumers that are slower than producers, so they are able to interrupt the data stream whenever necessary. Usually all this goes unnoticed, well hidden by the `pipe` method:

```js
readableStream.pipe(writableStream);
```

But we can explicitly pause the stream too, requesting chunks of data only when it's our will:

```js
const readableStreamAsyncIter = readableStream[Symbol.asyncIterator]();

await readableStreamAsyncIter.next(); // first chunk
// other async stuff
await readableStreamAsyncIter.next(); // second chunk
```

__Readable Streams__ cannot implement the synchronous iteration interfaces because they interact asynchronously with external resources like files. The point is that it's not a single, long interaction, but it is spreaded over time. That is because streams are not going to load the whole file, but only chunks of it, which flow to the consumer. Having a limited knowledge of the file itself, they are almost never able to solve synchronously the `done` flag.
&nbsp;

### The consumer pressure problem

Let's consider a generic async source:

```js
const ait = asyncSource[Symbol.asyncIterator]();
```

What will happen if we do like this?

```js
ait.next().then(...);
ait.next().then(...);
ait.next().then(...);
```

Each call to the __next__ method will cause the async source to start an __async task__ to provide a result, but the main problem is that these tasks will run in parallel, not sequentially. That is because the async iterator was moved forward synchronously.

We could say that the consumer is putting too much pressure on the producer. Odds are that the latter is unable to deal with it because:

1. Each async task could be the last, ending with a `done:true`. All the async tasks started after that shouldn't do any work, ending as soon as possible with `{value:undefined, done:true}`. Unfortunately, if tasks were started concurrently, chances are that at a certain point some of them will be doing completely useless work, wasting resources and probably causing problems, because one of the others has completed the iteration. And most likely they will not even finish correctly reporting the _out-of-bounds_ status.
2. Leaving aside the _end-of-iteration_ problem, let's focus on the results. What if the async source, to compute each async task result, need the ending value of the previous one? For example, think about cursor-based pagination. Tasks can be started concurrently, so it's impossible to create well-formed async iterables for these eventualities.

The truth is we need a way to force the iteration to be sequential, ensuring time consistency between both async and sync __next__, __throw__ and __return__ calls. Doing so, we'll also avoid the unfortunate, conceptually wrong situation where one call to one of those iteration methods is going to finish before than a previous one.

Since we will never be able to prevent a consumer to mess with the iteration's methods, we have to enqueue the calls to them with their respective arguments, if any. In this way, the async source will be able to properly handle them one after another.
At this point, things get quite complicated, but we don't have to worry about it because we have __async generators__, which have this feature out-of-the-box.

&nbsp;

# Conclusion

That's all you should know about __Asynchronous Iterators__!

We have learnt why the ability to resolve the `done` flag asynchronously could be vital in some circumstances. The fresh async iteration interfaces are here to help us reach the goal, and now you know all their main features and best practices.

Then we have seen an example of a simple async iterator, how the `for-await-of` loop behaves and why Node.js Readable Streams do support async iteration. We also have spent some words on a rarely considered but important problem that is very well resolved by the next, last big topic: __Asynchronous Generators__

I hope to see you there again 🙂 and on [twitter](https://twitter.com/JFieldEffectT)!

&nbsp;

# Acknowledgements

I would like to thank [Marco Iamonte](https://github.com/briosheje) for the time he spent helping me to identify a lot of grammatical errors.

&nbsp;

# Bibliography

* [ECMAScript 2019 specification](https://www.ecma-international.org/ecma-262/10.0/index.html)
* [Exploring JS](https://exploringjs.com/) series by Dr. Axel Rauschmayer
* [General Theory of Reactivity](https://github.com/kriskowal/gtor) by Kris Kowal
* [Asynchronous Iterators for JavaScript](https://github.com/tc39/proposal-async-iteration) by TC39
