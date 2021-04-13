+++
author = "Andrea Simone Costa"
title = "JavaScript Iterators and Generators: Synchronous Iterators"
date = "2019-08-25"
description = "All you should need to know about JavaScript Synchronous Iterators."
categories = ["javascript"]
series = ["JavaScript Iterators and Generators"]
tags = [
    "synchronous",
    "iterators",
]
featuredImage = "/images/jsitgen/1.png"
+++

__Series__: [JavaScript Iterators and Generators](/series/javascript-iterators-and-generators/)

# Introduction

The first thing to point out is that __iteration__ in JavaScript is based on a __protocol__: a set of conventions that replace what would have been __interfaces__ in a language with support for interfaces.
Anyway, the ECMAScript Specification [mostly uses the word "interface"](https://www.ecma-international.org/ecma-262/10.0/index.html#sec-iteration), therefore I will do the same.

To whom this concept may be new, you should imagine interfaces as contracts between two entities in your code. Without the contract, these two parts would know each other too much, becoming too dependent on each other: a change inside one would probably force us to change the other.

Going back to __iterators__, their main purpose is to allow the use of each element of a given collection. They are so good that the consumer doesn't need to know how the collection stores and manages those elements.
As long as the iterator interface(s) is respected, the consumer and the collection remain completely independents: we will be able to change the internal details of the collection without affecting the consumer. In fact, we could replace the entire collection with another one.
At the same time, the collection does know nothing about the consumer. Therefore it can be iterated by consumers also very different from each other.

Please, respect the contract.

&nbsp;

# The Iterable, the Iterator and the IteratorResult interfaces

There are three interfaces on which the whole iteration thing is based.
&nbsp;

### The Iterable

The __Iterable__ interface defines what an entity has to implement to be considered an iterable.
[The specification](https://www.ecma-international.org/ecma-262/10.0/index.html#sec-iterable-interface) says that an iterable has a required method, the __@@iterator__ method, which returns an object that implements the __Iterator__ interface.
What is __@@iterator__? Is a specific Symbol that we can find into the Symbol constructor: __Symbol.iterator__.

```js
const Iterable = { 
    [Symbol.iterator]() {
        return Iterator;
    } 
}
```

&nbsp;

### The Iterator

The __Iterator__ interface defines what an entity has to implement to be considered an iterator.
[The specification](https://www.ecma-international.org/ecma-262/10.0/index.html#sec-iterator-interface) says that an iterator has a required method: the __next__ method. This method, that is the fulcrum of the iteration itself, returns an object that implements the __IteratorResult__ interface. Its main purpose is to get the subsequent element from the collection until there are no more entries.

There are two other optional methods: the __return__ method and the __throw__ method. If they return a value, it must be an __IteratorResult__.
The purpose of the former is to signal to the iterator that the consumer is not going to call the __next__ method anymore, even if the iteration has not reached its end. In this way, the iterator will be able to perform any cleanup it may need to do.
The purpose of the latter is to signal to the iterator that the consumer has encountered an error.

All three methods accept at least one argument:

* the __next__ method should be able to receive one or more arguments, but as the specification says "their interpretation and validity is dependent upon the target iterator"
* the __return__ method should return back the received argument, inserting it into the returned __IteratorResult__
* the __throw__ method should throw the received argument, which usually is an exception

Remember to check the existence of the last two methods before calling them!

```js
const Iterator = {
    next() { 
       return IteratorResult;
    },
    return() {
       return IteratorResult;
    },
    throw(e) {
        throw e;
    }
}
```

&nbsp;

### The IteratorResult

The __IteratorResult__ interface defines what an entity has to implement to be considered a valid result of a generic iteration step.

[The specification](https://www.ecma-international.org/ecma-262/10.0/index.html#sec-iteratorresult-interface) says that an iterator result has two fields, both surprisingly optional: the __done__ field and the __value__ field.
The __done__ field is a boolean flag that signals the ends of an iteration. It should be __false__ as long as the values returned by the iterator are valid, to then become __true__ after the last valid value is returned. If the __done__ flag is omitted, it is considered to have the value __false__.
The __value__ field can contain any valid ECMAScript value. It is the current iteration value of each iteration step until the __done__ flag become __true__. After that, this is the return value of the iterator, if it supplied one. If the __value__ field is omitted, it is considered to have the value __undefined__.

```js
const IteratorResult = { 
    value: any, 
    done: boolean, 
}
```

&nbsp;

# Conventions

There are some general conventions that should be followed to create well-formed iterators:

1. Each __Iterable__ entity should return a fresh, new iterator each time the __@@iterator__ method is called.
2. Each __Iterator__ entity should be an __Iterable__ too (more on that later), implementing the __@@iterator__ method with a function that simply returns __this__, that is a reference to the iterator itself. This is a controlled exception of the previous rule.
3. Explicitly report each iteration step's valid __value__ with a __done__ flag set to __false__. Do not combine relevant values with `done:true`.
4. If the __return__ method or the __throw__ method are called, the iterator should be considered exhausted and any subsequent invocations of the __next__ method should no more return any valid value.
Anyway, if the current __return__/__throw__ call returns a value, it should be combined with `done: true`.
5. After the last __value__ was returned, the __next__ method should return `{ value: undefined, done: true }`. Do not throw errors. Simply signal the end of the iteration as indicated, even if the __next__ method is called several times after that.

&nbsp;

# Default iterators

Let's see how to use one of the most common iterators already present in the language. Because arrays implement the __@@iterator__ method by default, getting an iterator to iterate over an array is pretty straightforward:

```js
const array = [1, 2, 3];

// get a fresh, new iterator to iterate over the array
const iterator = array[Symbol.iterator]();
```

Now let's use it:

```js
// remember: we have to call the 'next' method to iterate

iterator.next(); // { value: 1, done: false } 
iterator.next(); // { value: 2, done: false } 
iterator.next(); // { value: 3, done: false } 
iterator.next(); // { value: undefined, done: true } 
iterator.next(); // { value: undefined, done: true }
```

You can see how some of the conventions we talked about earlier are respected:

* the last valid __value__  (`3`) is coupled with a `done:false`, not a `done:true`
* I intentionally went out of bounds to show you that no errors were thrown. Instead we are always getting back `{ value: undefined, done: true }`

Arrays are not the only built-in iterables: String objects, TypedArrays, Maps and Sets are iterables too, because each of their prototype objects implements the __@@iterator__ method.

&nbsp;

# Using iterators

Let's create a function that takes an iterable and a callback, passing to the latter each iterator result's value:

```js
function iterateOver(iterable, cb) {

    // let it throw if the iterable argument is not an iterable
    const iterator = iterable[Symbol.iterator]();

    // it will contains the iterator result of each step
    let iteratorResult;

    // starts the iteration
    iteratorResult = iterator.next();
    
    // do the while loop only for values coupled with 'done:false'
    while(!iteratorResult.done) {
        // pass to the callback the value of each step
        cb(iteratorResult.value);

        // move forward the iterator
        iteratorResult = iterator.next();
    };

    // before returning, let the iterator do some cleanup
    iterator.return && iterator.return();
}
```

Follow an example of its use:

```js
iterateOver([1,2,3], console.log); // 1, 2, 3
```

&nbsp;

### The for-of loop

Luckily we don't need to write such type of function: the JavaScript provides to us a dedicated syntax: the `for-of` loop.
Its logic could be summarized in the following points:

1. Call the __@@iterator__ method of the iterable.
2. Call the __next__ method of the received iterator with no arguments.
3. Check if the `done` flag of the just received iterator result is set to __true__; if so, jump to point number __5__. Otherwise, continue.
4. Provide to the client the value contained into the iterator result, then jump to point number __2__.
5. Discard the iterator result and call the __return__ method of the iterator with no arguments, if the method is present.

```js
for(const value of [1,2,3]) {
    console.log(value); // 1, 2, 3
} 
```

&nbsp;

### Array destructuring and the array spread operator

Behind instructions like `const [a, b] = iterable;` and `const clone = [...iterable]` lies the same mechanism: an iterator is get from the iterable to be usually used only partially with __array destructuring__, but until it is exausted with the __array spread operator__.

&nbsp;

# Custom iterators

Let's finally see two custom implementations of the three interfaces we have discussed above: an iterator for a collection and an iterator for a producer.
&nbsp;

### Collection

The following simple collection store all the names of the user that have joined a particular telegram group. The boolean flag indicates whether a user is an administrator of the group:

```js
const users = {
    james: false,
    andrew: true,
    alexander: false,
    daisy: false,
    luke: false,
    clare: true,
}
```

Now, let's create an iterator that returns only the administrators' names.

The first thing to do is to make the `users` collection an iterable, adding the __@@iterator__ method to it:

```js
const users = {
    // ...users
    
    [Symbol.iterator]() {
        // each call will return a new iterator
        const iterator = {
            next() {
                // we set the iterator skeleton
                // adding only an almost empty 'next' method, for now
                return { done: true };
            }
        }

        return iterator;
    }
}
```

If you think about it, we have just met all the requirements needed to properly implement, from the ECMAScript perspective, the iterators interfaces.
Obviously, the result is far away from what we really need. And we are not even respecting the aforementioned conventions.
But, just to let you know, `users` is now a full-fledged iterable and could be used __safely__ not only with the `for-of` loop, but also with __array destructuring__ and the __array spread operator__.

Enough fun for now, let's add the logic we need.
The second thing to do is to get an array with the object's keys, that we are going to iterate with an index. Both the array of keys and the index must be unique for each generated iterator, so they will be created during the call to the __@@iterator__ method:

```js
const users = {
    // ...users
    
    [Symbol.iterator]() {
        // here the relevant parts
        const keys = Object.keys(this);
        let index = 0;

        const iterator = {
            next() {
                return { done: true };
            }
        }

        return iterator;
    }
}
```

At each iteration step, we have to advance one or more position inside the `keys` array, skipping those that don't match with a `true` boolean flag inside the `users` collection.
Is noteworthy that I've changed the __next__ method signature, turning it into an arrow function to preserve the __this__ context:

```js
const users = {
    // ...users
    
    [Symbol.iterator]() {
        const keys = Object.keys(this);
        let index = 0;

        const iterator = {
            // here the relevant parts
            next: () => {
                // this === 'users'
                // skip all the normal users '!this[keys[index]]'
                // stop if we ran out of users 'index < keys.length'
                while (
                    !this[keys[index]] &&
                    index < keys.length
                ) { index++; }


                return { done: true };
            }
        }

        return iterator;
    }
}
```

Do not be scared by `!this[keys[index]]`.
Remember that `keys` is an array with the `users` object's keys, therefore an array containing the telegram group users' names. Thus, `keys[index]` will return the key, the name of a user, at the given index. After that, `this[key]` will simply return __true__ or __false__ depending on the user status.

Now let's focus on the iterator result that we have set to `{ done: true }` for convenience.
If you are asking, we could have returned an empty object `{}` and the __IteratorResult__ interface would have been respected anyway. However, don't forget that a missing __done__ flag means `done:false`. Therefore, if you had tried to use the `users` object inside a `for-of` loop, for example, you would have stuck your browser because the `for-of` would never have ended.

To properly set the __done__ flag, we can check if we have exceeded the numbers of keys thanks to the `length` property of the `keys` array.
To set each returned __value__, since we want the administrators' names, we can simply get the name corresponding to the current index:

```js
const users = {
    // ...users
    
    [Symbol.iterator]() {
        const keys = Object.keys(this);
        let index = 0;

        const iterator = {
            next: () => {
                while (!this[keys[index]] && index < keys.length) index++;

                
                // here the relevant part
                return { 
                    done: index >= keys.length,
                    // after reading the name corresponding to the current index,
                    // do not forget to move forward the 'index'
                    // for the next iteration
                    value: keys[index++],
                };
            }
        }

        return iterator;
    }
}
```

That's it!

Let's try to use it:

```js
[...users].forEach(name => console.log(name));
// andrew, clare
```

&nbsp;

### A necessary digression

Let's take an array:

```js
const array = [1, 2, 3];
```

and feed a `for-of` loop with it:

```js
for (const n of array) {
    console.log(n);
}
```

We already know the output:

```js
// first iteration: 1
// second iteration: 2
// third iteration: 3
```

&nbsp;
What about that:

```js
const iterator = array[Symbol.iterator]();

// we no more provide to the 'for-of' loop the array
// but we provide an iterator of the array
for (const n of iterator) {
    console.log(n);
}
```

What do you expect? An exception? Wrong!
The outcome will be exactly the same:

```js
// first iteration: 1
// second iteration: 2
// third iteration: 3
```

<img src="https://thepracticaldev.s3.amazonaws.com/i/71q9m1hwlri3zv4he3cu.jpg" width="350"/>
&nbsp;
Let's try the same with our custom iterable:
```js
const userIterator = users[Symbol.iterator]();

for (const name of userIterator) {
    console.log(name);
}

```
What do you expect? The same output as before (I mean `andrew, clare`)? Wrong!
You'll get an exception: `TypeError: userIterator is not iterable`.

Of course, `userIterator` is not an __iterable__, it is an __iterator__! But wait a moment, why doesn't it make any fuss with the `array` iterator? What's the difference?
The truth is that default iterators, like the `array` one, are both an __iterator__ and an __iterable__. But what in the world should mean iterating over an iterator?

Inception.

Don't worry. We'll return soon to this point, to finally explain the convention number __2__.
&nbsp;
### Producer
Another place where iterators shine is the __producers__ land.
A producer is a stateful function which return values depend on the previous returned ones. A classic example is a function that returns the next number of the Fibonacci series, starting from __0__. Let's try to code it:
```js
const fibonacciProducer = (function IIFE() {

    // here we store the state
    let previousValue = 1; // for convenience
    let currentValue = 0;

    // here it is: a closure
    return function realFibonacciProducer() {
        // clone the currentValue
        const valueToBeReturned = currentValue;

        // calculate the next value
        const nextValue = previousValue + currentValue;

        // update the state
        previousValue = currentValue;
        currentValue = nextValue;

        // return the correct value
        return valueToBeReturned;
    }
})();
```

Here it is what happens if you call `fibonacciProducer`:

```js
fibonacciProducer(); // 0
fibonacciProducer(); // 1
fibonacciProducer(); // 1
fibonacciProducer(); // 2
fibonacciProducer(); // 3
fibonacciProducer(); // 5
fibonacciProducer(); // 8
fibonacciProducer(); // 13
// ...
```

There is nothing wrong with this implementation, apart from a missing integers owerflow check, but we can improve it adding iterators to let it be usable with all the ES6 features that plays well with iterables, like `for-of` loops.
Let's do it:

```js
const fibonacciProducer = (function IIFE() {

    // enhanced version of the previous 'realFibonacciProducer'
    function updateState({previousValue, currentValue}) {
        // calculate the next value
        const nextValue = previousValue + currentValue;

        // new values to update the state
        const newPreviousValue = currentValue;
        const newCurrentValue = nextValue;

        // return the new values
        return {
            newPreviousValue,
            newCurrentValue
        };
    }

    // 'fibonacciProducer' will be an iterators factory
    return function iteratorFactory() {

        // each iterator will have its own state   
        let previousValue = 1; // for convenience
        let currentValue = 0;
        
        const iterator = {
            next: () => {

                // integers owerflow check
                const outOfRange = currentValue > Number.MAX_SAFE_INTEGER;
                
                const iteratorResult = {
                    done: outOfRange,
                    value: outOfRange ? void 0 : currentValue,
                }

                if(!outOfRange) {
                   // update the current state
                   const newState = updateState({previousValue, currentValue});
                   currentValue = newState.newCurrentValue;
                   previousValue = newState.newPreviousValue;
                }

                return iteratorResult;
            }
        }

        return iterator;
    }
})();
```

Here's how to use the enhanced `fibonacciProducer`:

```js
// request an iterator
const fibonacciIterator = fibonacciProducer();

// use it!
fibonacciIterator.next() // { done: false, value: 0 }
fibonacciIterator.next() // { done: false, value: 1 }
fibonacciIterator.next() // { done: false, value: 1 }
fibonacciIterator.next() // { done: false, value: 2 }
fibonacciIterator.next() // { done: false, value: 3 }
fibonacciIterator.next() // { done: false, value: 5 }
fibonacciIterator.next() // { done: false, value: 8 }
fibonacciIterator.next() // { done: false, value: 13 }
// ...
```

Thanks to the iterator interface we also got the possibility to restart the the production of values out of the box: it is sufficient to request another iterator!
&nbsp;

### The IterableIterator pattern

Unfortunately, the following code continues to throw an exception:

```js
const fibonacciIterator = fibonacciProducer();

for (const value of fibonacciIterator) {
    console.log(value);
}
```

because `fibonacciIterator` is an __iterator__ but not an __iterable__.

Pay attention to this fact: __there is not a collection into play to be given directly to the `for-of` loop__ as we could do with the previous array.
We can only get iterators from `fibonacciProducer`.
This is an expected but also a wanted boundary to help you understand the __IterableIterator__ pattern.

In fact, it may happen that we have to handle an iterator disconnected from any collection, as in the producer case, or derived from a collection that we cannot directly reach.
We could have created an iterator from a collection and we have provided only the iterator to a function: the subroutine won't be able to directly use the collection. Another example: the collection is a private member of a class, therefore not directly accessible. However, the class provides a method that returns an iterator for that collection.

If we want to be able to use the ES6 features written for iterables with those types of iterators, we have to force them to be iterables too.

* __How__? The iterator should return itself if used like an iterable:

```js
const Iterator = {
    next() {
        return IteratorResult;
    },
    [Symbol.iterator]() {
        return this;
    }
}
```

* __What's the meaning of that__? Remember what utilities like the `for-of`  loop do: they call the __@@iterator__ method to get an iterator from an iterable.
If the entity to which the iterator is requested is itself an iterator, it should simply return itself!

Don't consider this point as a special case that can be forgotten.
__All the iterables__ present by default in the language provide iterators defined with this characteristic. __All the iterators__ that you can get with any language feature, like generators, follow this convention.
Therefore is a good idea to always implement iterators that are also iterables, even because is unlikely you know beforehand how the collections and iterators you create will be used.

&nbsp;

# Conclusion

We are at the end of the first article about __Iterators and Generators__.

We have learnt why the iterator pattern is so important, how JavaScript wants us to implement the three interfaces (Iterable, Iterator, IteratorResult) and some useful conventions which we should adhere to.
Then we have seen an example of a default iterator provided by the language, how to use it with the most common ES6 feature and what should be done to create iterators that could be used which such features.
We also have analyzed in detail how to define custom iterables for both a custom collection and a producer.

Next article will focus on __Generators__, a nice ES6 feature that could be used to create iterators and to do a lot of interesting stuff!

I hope to see you there again 🙂 and on [twitter](https://twitter.com/JFieldEffectT)!

&nbsp;

# Acknowledgements

I would like to thank [Nicolò Maria Mezzopera](https://twitter.com/DonNicoJs) for helping me identify a lot of grammatical errors. If you are a __Vue.js__ developer, you need to check out his next workshop: [vueandme](https://vueand.me/).
I also wish to thank Gabriele Di Simone, Marco Terzolo and Giovanni Riga for the time they've spent to check the article.

&nbsp;

# Bibliography

* [ECMAScript 2019 specification](https://www.ecma-international.org/ecma-262/10.0/index.html)
* [You Don't Know JS](https://github.com/getify/You-Dont-Know-JS) series by Kyle Simpson
* [Exploring JS](https://exploringjs.com/) series by
Dr. Axel Rauschmayer
