+++
author = "Andrea Simone Costa"
title = "JavaScript Iterators and Generators: Synchronous Generators"
date = "2019-09-01"
description = "All you should need to know about JavaScript Synchronous Generators."
categories = ["javascript"]
series = ["JavaScript Iterators and Generators"]
tags = [
    "synchronous",
    "generators",
]
featuredImage = "/images/jsitgen/2.png"
images = ["/images/jsitgen/2.png"]
+++

__Series__: [JavaScript Iterators and Generators](/series/javascript-iterators-and-generators/)

# Introduction

Generators are a very particular type of __function__.
In JavaScript, we are used to waiting for the completion of a subroutine before being able to continue with the program. In other words, each function will run until the end of its body and no other code is able to interfere, running in between.

Generators break this rule, allowing us to __pause__ their execution and enabling a straightforward messages system to pass information in both directions.
Functions marked with the `async` keyword, thanks to the `await` superpower, are able to not follow the rule too because they are a direct consequence of generators.

<img src="https://thepracticaldev.s3.amazonaws.com/i/w9knw1mdedq7y8fdqiyr.jpg" width="400"/>

There are plenty of uses cases for generators. They can be used to: implement iterators, implement producers, write asynchronous code in a synchronous fashion and implement both preemptive and non-preemptive multitasking, to name a few.
A lot of cool projects based on them are availabe, like: [redux-saga](https://github.com/redux-saga/redux-saga), [hertzscript](https://github.com/hertzscript) and [tj/co](https://github.com/tj/co).

In any case, the focus of the article will be generators from a theoretical perspective: we will talk more about what they are and how they behave accordingly to the specification than what can be done with them.
As practical examples, I've chosen to repropose the `users` object and the `fibonacciProducer` function to let you see how generators are able to make our life easier also when there is no rocket science involved.

&nbsp;

# Generators

A generator declaration is pretty much the same as a function declaration plus the addition of a star between the `function` keyword and the function name:

```js
function * generator(...args) { 
    yield; 
}
```

You are allowed to create [anonymous generators](https://tc39.es/ecma262/#prod-GeneratorExpression), but fat arrow generators are not currently granted by the ECMAScript specification.

A generator invocation is the same as a function invocation:

```js
generator(...);
```

The big syntax difference is obviously the possibility to use a new keyword inside the body of the generator: the __yield__ keyword. It returns the control to the caller suspending the execution of the generator. The generator will literally stop on each encountered `yield` waiting a signal to resume.

Like with the `return` keyword, you are able to return a value each time you use the `yield` keyword. Moreover, the signal that notifies the generator to resume its flow could be coupled with a value in turn.
This is the message system I mentioned earlier explained in simple terms.
&nbsp;

### The generator object

Because of the _stop & go_ philosophy of the generators, it is not difficult to understand why __iterators__ were chosen for their control.
Let's see what I mean:

```js
// a generator
function* someOddNumbers() {
    yield 1;
    yield 3;
    yield 5;
    yield 7;
    return 9;
}

// we invoke it
const generatorObject = someOddNumbers();
```

What is that mysterious __generatorObject__? Why the result is not simply the value `1`? We'll just say that when a generator function is invoked, a specific object is returned, which is both an __Iterator__ and an __Iterable__. It is called __generator object__<sup>[1]</sup>.
Pay attention to the fact that no generator code is executed at this point.

Anyway, if the result is an iterator, we should be able to call its __next__ method. Let's try:

```js
generatorObject.next();
```

Are you able to guess the result? It's `{ value:1, done:false }`.
That is because the generator will start to execute its body until a `yield` keyword is encountered, where it will pause. The value `1` was coupled with the first `yield` occurrence, so it will be inserted into the __iterator result__, with the not surprising `value` key, returned by the __next__ method invocation.
Obviously, we are still far from the generator's body end, so the `done` flag is __false__.

We have just learned so much thanks to these two invocations. Let's recap the main points:

1. When a generator function is called, like `someOddNumbers()`, an iterator is returned.
2. A _generator function invocation_ does not mean _generator execution_.
3. To start the execution of the code inside a generator, we have to call the __next__ method that we can find into the iterator just taken.
4. The generator's body is executed until a `yield` keyword is encountered, where it will pause returning us the value linked to that `yield` keyword well packaged inside an iterator result.

&nbsp;

### Resuming the execution

How to signal to the generator that it should resume its execution? We just have to call the __next__ method again:

```js
generatorObject.next(); // { value:3, done:false }
```

You can see that the generator will pause on the next `yield` occurence, returning us the _yielded_ value: `3`.

Now, let's exhaust the iterator to better understand how the `done` flag behaves:

 ```js
generatorObject.next(); // { value:5, done:false }
generatorObject.next(); // { value:7, done:false }
generatorObject.next(); // { value:9, done:true }
generatorObject.next(); // { value:undefined, done:true }
```

If you pay attention, some of [the conventions which we have discussed in the previous article](https://dev.to/jfet97/a-series-on-javascript-iterators-and-generators-synchronous-iterators-3m2h-temp-slug-7995462?preview=855de4db8cc14995ef941dcd5a5ebf5d4283e80ccc055dd4925b71e9a9ee39a9e8e3ca7a83a86516134e2ea850278c8b2dee6fee3db92ec1f7698aa7#conventions) are respected.

Let me show you why.

All the __yielded__ values were returned with the purpose of sending messages to the caller. The first part of the convention number __3__ is clear, so all these values are paired with `done:false`.

The __returned but no yielded__ last value (`9`) falls into the convention number __4__. This happens because the value is __returned__, so there shouldn't be differences between that and an explicit call, which we will examine later, to the __return__ method of the iterator.
Take that as a game rule, don't twist your brain. So, never return a relevant value with the __return__ keyword because it is always paired with `done:true` and the second part of the convention number __3__ is clear on this topic.
<u>Remember</u>: all the ES6 utilities tailored to suit for iterators always discard all the values that are combined with `done:true`, stopping themselves at the first occurrence of it:

```js
const generatorObject = someOddNumbers();
// 9 will be discarded
[...generatorObject]; // [1, 3, 5, 7]
```

The last __undefined-true__ pair represents the out-of-bounds state, following the convention number __5__.
&nbsp;

### Generators instances

It's worth noting that each time a generator function is called producing an iterator, an independent instance of that generator is created too, which the iterator will control.
Multiple instances of the same generator will never implicitly influence one another:

```js
const iter1 = someOddNumbers();
const iter2 = someOddNumbers();

// let's use a bit the first iterator 
iter1.next(); // { value:1, done:false } 
iter1.next(); // { value:3, done:false } 
iter1.next(); // { value:5, done:false } 

// the second iterator does handle a generator instance that is
// completely independent from the one under the control 
// of the first iterator
iter2.next(); // { value:1, done:false }
```

&nbsp;

# The messaging system

Let's take a closer look at the main possibility we have to send information into the generator.

Let's consider the following generator:

```js
function* lazyCalculator(operator) {
    const firstOperand = yield;
    const secondOperand = yield;
    
    switch(operator) {
        case '+':
           yield firstOperand + secondOperand;
           return;
        case '-':
           yield firstOperand - secondOperand;
           return;   
        case '*':
           yield firstOperand * secondOperand;
           return; 
        case '/':
           yield firstOperand / secondOperand;
           return;  
    }
}
```

Focus on the fact that the generator needs three inputs: an __operator__ and two __operands__. I've chosen to set the operator during the invocation of the generator; on the contrary the operands will be provided lazily.

This is how the generator has to be used:

```js
// I choose to perform the multiplication operation 
const lazyCalculatorIterator = lazyCalculator("*");
```

We already know that no generator code was executed during the previous call. We have to call the __next__ method __for the first time__ to start it:

```js
lazyCalculatorIterator.next(); // {value: undefined, done: false}
```

Let's reasoning about that:

* why no value was provided for the first operand during the previous call?
* why we are getting `undefined` as resulting value?

Pay attention to the fact that the __first next__ call is moving the generator towards the first `yield` keyword occurrence, not from that to the second.
Therefore no value should be passed to the __first next__ call because there is not a `yield` keyword waiting for that value. That value will be silently discarded.
If you need to pass one or more values as initial settings for a generator, provide them during the generator function call as I did to set the operator.
Not even the `undefined` result should surprise us because the first `yield` hasn't returned anything.

At this point, the generator instance is paused onto the first `yield` keyword waiting for a value to complete the assignment to the `firstOperand`.

Do not be scared by statements like: `const firstOperand = yield;`. Just imagine the `yield` keyword also as a placeholder for a future value, not only a weird way to return things.
You won't be able to directly use that placeholder everywhere in an expression:

```js
function* gen() {
    const sum = yield + yield;
}
// Uncaught SyntaxError: Unexpected identifier
```

because of the low precedence of the `yield` keyword, but you will be able to resolve the problem thanks to parenthesis:

```js
function* gen() {
    const sum = (yield) + (yield);
}
```

&nbsp;

To resume the generator, let's pass the first operand calling the __next__ method __for the second time__:

```js
lazyCalculatorIterator.next(10); // {value: undefined, done: false}
```

We have received back `undefined` again because the second `yield` keyword, on which the generator is currently paused, hasn't returned anything too.

Now we can pass a value for the second operand:

```js
lazyCalculatorIterator.next(2); // {value: 20, done: false}
```

to then receive the result of the operation we have chosen.

If we follow the generator flow, we are able to understand why.
After the __third__ call to the __next__ method, the generator will resume from the __second__ `yield` keyword towards the __third__. The latter is going to always return `firstOperand [op] secondOperand`, so the mathematical expression is evaluated, to then producing a value to be returned back into the `value` field of the third iterator result.

At this point, the generator is waiting for a value for the __third__ `yield` keyword, but we are able to see that the value we are going to provide won't be actually used. Therefore, the __fourth__ call to the __next__ method will be performed without arguments:

```js
lazyCalculatorIterator.next(); // {value: undefined, done: true}
```

After the call, the generator has encountered the __return__ keyword, ending its execution and signalling it to us (`done:true`). No value was explicitly returned, so we get `undefined` again.
&nbsp;

Let's recap the main points:

1. To send a value inside a paused generator, simply pass an argument when you call the __next__ method to resume it.
2. The argument passed to the __nth next__ method call will be used in place of the __(n-1)th__ `yield`.
3. The __nth returned__ value will be the result of the __nth next__ method call.
4. Do not provide arguments to the __first next__ method call because they will be discarded. Use the generator function call to pass some settings instead.

&nbsp;

# More on generators

### Iterators and Iterables

Let's resume the `someOddNumbers` generator and the following script:

```js
const generatorObject = someOddNumbers();
[...generatorObject]; // [1, 3, 5, 7]
```

This works without throwing any exceptions because, remember, each __generator object__ is both an iterator and an iterable. It does follow the convention number __2__.
Therefore, when the __array spread operator__ calls the __@@iterator__ method of the generator object to get an iterator, it will receive the generator object itself.

Pay attention to the fact that the generator function itself is not iterable:

```js
for (const v of someOddNumbers) {
    console.log(v);
}
// TypeEror: someOddNumbers is not iterable
```

You have to call it to get the __iterable-iterator__:

```js
for (const v of number()) {
    console.log(v); // 1 3 5 7
}
```

&nbsp;

### Errors handling

Generators are functions, therefore the `try-catch-finally` statement can be used into them:

```js
function* generator() {
    try {
        aFunctionThatMayThrow();
    } catch(e) {
        console.log(e);
    } finally {
        console.log("Finally block triggered!");
    }
}
```

If a thrown error is not handled by any `catch` block, the exception will be thrown outwards from inside the generator, ending it. The iterator that was controlling that instance of the generator will become useless:

```js
function* generator() {
    yield 1;
    yield 2;
    
    throw Error();

    yield 3;
    yield 4;
}

const it = generator();
it.next(); // {value: 1, done: false}
it.next(); // {value: 2, done: false}

it.next(); // !!! Uncaught Error !!!

it.next(); // {value: undefined, done: true}
it.next(); // {value: undefined, done: true}
```

&nbsp;

#### Including the yield keyword

Things become interesting when you include one or more `yield` statements inside such type of block:

```js
function* generator() {
    try {
        yield;
    } catch(e) {
        console.log(e);
    } finally {
        console.log("Finally block triggered!");
    }
}
```

That leads to two logic consequences:

1. The `yield` statement is able to pause the `try-catch-finally` statement, letting the `catch` be able to handle future errors.
2. There should be a way to insert into the generator not merely an `Error` object, but the awareness of an error condition generated by external causes.

This is where the __throw__ method comes into play, that is implemented by each generator object. It takes an optional argument, that should be an error, throwing it into the generator in the point where it was paused.
If the respective `yield` is surrounded by a `try-catch` block, the generator will be able to recover from the erroneous situation, continuing its flow. Otherwise, the error will be thrown out like all the unhandled exceptions that could normally raise up from inside the generator, with the same consequences.

```js
function* generator() {
    try {
        yield 1;
    } catch(e) { console.log(e) }

    yield 2;
    yield 3;
    yield 4;
    yield 5;
}

const it = generator();

it.next(); // {value: 1, done: false}

// the error will be handled and printed ("Error: Handled!"),
// then the flow will continue, so we will get the
// next yielded value as result.
it.throw(Error("Handled!")); // {value: 2, done: false}

it.next(); // {value: 3, done: false}

// now the generator instance is paused on the
// third yield that is not inside a try-catch.
// the error will be re-thrown out
it.throw(Error("Not handled!")); // !!! Uncaught Error: Not handled! !!!

// now the iterator is exhausted
it.next(); // {value: undefined, done: true}
```

&nbsp;

### Early return

At any time you can trigger an early return by calling the __return__ method of the generator object, ending it. If an argument is provided, it will be returned inside the iterator result. The iterator will become obviously exhausted:

```js
function* generator() {
    yield 1;
    yield 2;
    yield 3;
    yield 4;
    yield 5;
}

const it = generator();

it.next(); // {value: 1, done: false}
it.next(); // {value: 2, done: false}
it.next(); // {value: 3, done: false}

it.return(10); // {value: 10, done: true}

it.next(); // {value: undefined, done: true}
```

&nbsp;

### Generator delegation

In the same way a function is able to call a second function, a generator is able to invoke another generator. This is strongly linked with a better code organization, a proper separation of concerns, improved modularity, better maintainability and so on.

We are already able to control the resulting iterator from within the generator that has called the second generator:

```js
function* mainGenerator() {
    const innerIt = innerGenerator();
    
    const sum = [...innerIt].reduce((a, v) => a + v, 0);
    
    yield sum;
}

function* innerGenerator() {
    yield 1;
    yield 2;
    yield 3;
    yield 4;
    yield 5;
}

const it = mainGenerator();

it.next(); // {value: 15, done: false}
```

&nbsp;

#### The bridge

But, how we could do to achieve a full control of the inner iterator from the outer one, to reach the highly acclaimed __generator delegation__?
We should be able to create a bridge that would allow us to forward all the __next__ method calls performed on the `it` iterator, with their arguments, to the `innerIt` iterator, and all the _yielded_ values from the `innerGenerator` should become the results of those call.
What about the returned value of the inner generator, which could be sent by the `return` keyword? It should keep a special eye on it. Moreover, the bridge should allow us to forward the __throw__ and the __return__ methods calls, with their respective consequences, as well as all the unhandled exceptions that may be thrown.
Last, but not least, the bridge should be able to connect with an inner version of itself, to properly handle nested generator delegation.

It turns out that this bridge was already built for us, and its name is `yield*`:

```js
function* mainGenerator() {
    const innerIt = innerGenerator();
    
    // here it is: generator delegation
    yield* innerIt;
}

function* innerGenerator() {
    yield 1;
    yield 2;
    yield 3;
    yield 4;
    yield 5;
}

const it = mainGenerator();

it.next(); // {value: 1, done: false}
it.next(); // {value: 2, done: false}
it.next(); // {value: 3, done: false}
it.next(); // {value: 4, done: false}
it.next(); // {value: 5, done: false}

it.next(); // {value: undefined, done: true}


// now we do the same thing as before
[...mainGenerator()].reduce((a, v) => a + v, 0); // 15
```

We have therefore obtained complete control of the inner generator instance, giving it to the external iterator `it`. But we have exposed to the client of the `it` iterator some internals details which before were hidden inside the `mainGenerator` generator.
But, come to think of it, that was the purpose of the bridge...
&nbsp;

#### Iterables, again

If you pay attention, you can see that in the previous example I've written `yield* innerIt`, not `yield* innerGenerator`.
That is because `yield*` transfers iteration control, not generator control. Therefore you are allowed to use it with all the iterables you know, even with those built by you:

```js
function* arrayDelegator(array) {
    yield* array;
}

const it = arrayDelegator([1, 2, 3, 4, 5]);

it.next(); // {value: 1, done: false}
it.next(); // {value: 2, done: false}
it.next(); // {value: 3, done: false}
it.next(); // {value: 4, done: false}
it.next(); // {value: 5, done: false}

it.next(); // {value: undefined, done: true}
```

Yes you guessed it: even `yield*` calls the __@@iterator__ method.
&nbsp;

#### Recursive generators

One of the main benefits of the generator delegation is that recursion with generators becomes straightforward:

```js
function* chunkify(array, n) {
    yield array.slice(0, n);
    array.length > n && (yield* chunkify(array.slice(n), n));
}

[...chunkify([1, 2, 3, 4, 5, 6, 7, 8], 3)];
// [[1, 2, 3], [4, 5, 6], [7, 8]]
```

Don't let this code scare you! You are able to fully understand it 😃.
Each time `chunkify` is called, it yields out at most `n` elements of its input array starting from the left, to then __delegate__ the remaining part of the array to...itself!
Every time a further step of the generator recursion is performed, you are adding a new span to the bridge that connects the outermost iterator, that is the one used by the array spread operator, to the innermost one. Each yielded value, at any level, will be routed on this bridge to reach the outside.
&nbsp;

#### Exceptions and the behaviour of the throw method

During delegation, it could happen that an inner iterator is not able to handle an exception. In such a case, the exception will go back through the delegation chain until it is caught. All the generators instances crossed by the exception that was coming up, which were lacking a proper `try-catch`, will be stopped one after another:

```js
function* innerGenerator() {
    yield "innerGenerator:start";

    throw Error(); // <-- here the exception

    yield "innerGenerator:end"; // <-- never yielded
}

function* middleGenerator() {
    yield "middleGenerator:start";

    yield* innerGenerator();

    yield "middleGenerator:end"; // <-- never yielded
}

function* outerGenerator() {
    yield "outerGenerator:start";

    try {
        yield* middleGenerator();
    } catch {}

    yield "outerGenerator:end";
}

const it = outerGenerator();

it.next(); // {value: "outerGenerator:start", done: false}
it.next(); // {value: "middleGenerator:start", done: false}
it.next(); // {value: "innerGenerator:start", done: false}

it.next(); // {value: "outerGenerator:end", done: false}
// the exception was thrown,
// both 'innerGenerator' and 'middleGenerator' weren't able to handle it
// so their execution is ended.
// The exception bubbles up to 'outerGenerator' which catches it,
// to continue its flow then.

it.next(); // {value: undefined, done: true}
```

&nbsp;
Obviously, if even the `outerGenerator` hadn't been able to catch the exception, the result of calling the __next__ method for the __fourth__ time would have been an error because the exception would have risen to the surface and the call is not wrapped by a `try-catch` block.

What if the __throw__ method is called on the outermost iterator? Each call to the __throw__ method will reach the innermost iterator, passing to it the error.
If the waiting `yield`, on which the generator instance controlled by that iterator is paused, is wrapped by a `try-catch` block, we know that the generator will be able to recover from the injected erroneous situation.
Otherwise, the exception will be thrown from the current innermost generator and we have just learned what is going to happen.

```js
function* innerGenerator() {
    try {
        yield "innerGenerator:start";
    } catch(e) {
        yield `innerGenerator:catched ${e.message}`;
    }
    yield "innerGenerator:end";
}

function* middleGenerator() {
    yield "middleGenerator:start";

    yield* innerGenerator();

    yield "middleGenerator:end"; // <-- never yielded
}

function* outerGenerator() {
    yield "outerGenerator:start";

    try {
        yield* middleGenerator();
    } catch(e) {
        yield `outerGenerator:catched ${e.message}`;
    }

    yield "outerGenerator:end";
}

const it = outerGenerator();

it.next(); // {value: "outerGenerator:start", done: false}
it.next(); // {value: "middleGenerator:start", done: false}
it.next(); // {value: "innerGenerator:start", done: false}

it.throw(Error(42)); // {value: "innerGenerator:catched 42", done: false}
// the error was injected into 'innerGenerator'
// but the target 'yield' was wrapped inside a try-catch

it.next(); // {value: "innerGenerator:end", done: false}

it.throw(Error('foo')); // {value: "outerGenerator:catched foo", done: false}
// the error was injected into 'innerGenerator'
// but the target 'yield' wasn't wrapped inside a try-catch
// as also the 'yield*' inside the 'middleGenerator' was not.
// The exception was handled by 'outerGenerator'

it.next(); // {value: "outerGenerator:end", done: false}

it.next(); // {value: undefined, done: true}
```

&nbsp;

#### The behaviour of the return keyword

What about explicitly returned values?

```js
function* innerGenerator() {
    yield 1;
    yield 2;
    yield 3;
    yield 4;
    yield 5;

    return 6; // <-- see here
}

function* delegator() {
    const res = yield* innerGenerator();
    console.log(res);  // 6 <-- and here
}

[...delegator()]; // [1, 2, 3, 4, 5]
```

We are used to the fact that values paired with `done:true` are discarded by the ES6 utilities that interact with iterables, but the `yield*` keyword is an exception to that, though not so huge.

Following the example of the bridge, we can say that all the values returned with the __return__ keyword are not routed to the outside, therefore they are, to some extent, discarded. Do you see the outcome of the array spread operator in the last example? There is no `6`.
But it is also true that the `yield*` needs to be replaced with an actual value when the delegation is terminated. Here is the end of the returned value!
&nbsp;

#### The behaviour of the return method

I personally consider the behaviour of the __return__ method conceptually different from the __next__ and the __throw__ methods.
That is because the latter ones do not influence the chained iterators directly, they do cross them to reach the innermost generator and what will happen next depends all on it.

On the contrary, the outcome of a __return__ method call is different:

```js
function* innerGenerator() {
    yield 1;
    yield 2;
    yield 3;
    yield 4;
    yield 5;
}

function* delegator() {
    console.log("yield* result: ", yield* innerGenerator());
    yield 6;
}

const it = delegator();

it.next(); // {value: 1, done: false}
it.next(); // {value: 2, done: false}
it.next(); // {value: 3, done: false}

// {value: 100, done: true} with no value printed
// not {value: 6, done: false} with "yield* result: 100" printed
it.return(100); 

it.next(); // {value: undefined, done: true}
```

You could be tempted to think that the call to the __return__ methods during the delegation to an `innerGenerator` instance would simply stop that instance with `100` as a forced return value. This whould be followed by `"yield* result: 100"` printed to the console, because `100` would be the result of the delegation. After that, `6` would be returned because of the lasy `yield`.

But the reality is different because a __delegated method call__ implies subsequent calls of the method, starting from the outermost iterator, the one on which the call was originally performed, to the innermost one.
This regarding the __next__ and the __throw__ methods has the sole consequence of data transmission when performed on generator objects.

Instead, we know that a __return__ method call performed onto an iterator that is controlling a generator instance will set that instance as completed. This means that delegating the __return__ method call will end not only the innermost generator instance but all the generators instances on the chain.
In other words, __the whole iteration will be stopped__.
The returned value of each __return__ method call will be the input value for the next one in line. The last, the one returned by the innermost __return__ method call, will be the result of the whole return operation.

Will follow another example to let you understand. Do not focus on the workaround I've made to show you all the values; focus on the call order and see how the returned values behave:

```js
const innermostIterableIterator = {
    [Symbol.iterator]() {
        return this;
    },
    next() {
        return {value: "innermost", done: false}
    },
    return(v) {
        console.log(`innermostIterableIterator return method was called with ${v}`);
        return {value: v+1, done: true};
    }
}

const middleIterableIterator = {
    *_realIteratorsFactory() {
        yield* innermostIterableIterator;
        yield "middleIterableIterator is still alive"; // <-- will never be printed
    },
    [Symbol.iterator]() {
        const itToBeReturned = this._realIteratorsFactory();
        
        const originalReturnMethod = itToBeReturned.return.bind(itToBeReturned);

        itToBeReturned.return = function(v) {
            console.log(`middleIterableIterator return method was called with ${v}`);
            return originalReturnMethod(v+1);            
        }

        return itToBeReturned;
    }
}

function* outermostIterableIteratorGenerator() {
    yield* middleIterableIterator;
    yield "outermostIterableIterator is still alive"; // <-- will never be printed
}

const main = outermostIterableIteratorGenerator();

main.return = (() => {
    const originalReturnMethod = main.return.bind(main);

    return function(v) {
        console.log(`mainIterableIterator return method was called with ${v}`);
        return originalReturnMethod(v+1);     
    }
})();

main.next(); // {value: "innermost", done: false}
main.next(); // {value: "innermost", done: false}
main.next(); // {value: "innermost", done: false}

main.return(10);
// in order:
//    1 "mainIterableIterator return method was called with 10" is printed
//    2 "middleIterableIterator return method was called with 11" is printed
//    3 "innermostIterableIterator return method was called with 12" is printed
//    4 {value: 13, done: true} is returned
```

&nbsp;

# Refactoring our iterables

In the previous article, we've enhanced a simple collection (`users`) making it a well-formed iterable by implementing the __Iterable__, the __Iterator__ and the __Iterables__ interfaces by hand. We have also transformed a simple producer of the Fibonacci series numbers (`fibonacciProducer`) into an iterators producer.

Let's try to refactor both using generators!
&nbsp;

### users

```js
const users = {
    james: false,
    andrew: true,
    alexander: false,
    daisy: false,
    luke: false,
    clare: true,

    *[Symbol.iterator]() { // this === 'users'
      for (const key in this) {
        if (this[key]) yield key;
      }
    }
}
```

Whoa! Only __three__ lines!
If you think about it, the needed logic is very little: _yield_ only those __keys__ to which a __true value__ matches.
&nbsp;

### fibonacciProducer

```js
const fibonacciProducer = (function IIFE() {

    function updateState({previousValue, currentValue}) {
        const nextValue = previousValue + currentValue;
        const newPreviousValue = currentValue;
        const newCurrentValue = nextValue;
        return {
            newPreviousValue,
            newCurrentValue
        };
    }

    // 'fibonacciProducer' will be a generator
    return function* iteratorFactory() {

        // each iterator will have its own state   
        let previousValue = 1;
        let currentValue = 0;

        while (true) {
            // return the current value
            yield currentValue;

            // then update the state
            const newState = updateState({previousValue, currentValue});
            currentValue = newState.newCurrentValue;
            previousValue = newState.newPreviousValue;

            // if we get out of bounds, stop the producer
            if (currentValue > Number.MAX_SAFE_INTEGER) { return };
        }
    }
})();
```

Whoa! There is a `while(true)`!
Usually, an infinite loop within a function is not a great idea, but with generators it doesn't lead to any issue because of the `yield` keyword: we are able to pause that infinite loop.
The new logic of the `fibonacciProducer` isn't so much different from the old one: each time the __next__ method is called the current value of the series is returned back to the client, but, apart from the first iteration, a check is made first to see if the `Number.MAX_SAFE_INTEGER` limit was not reached.

&nbsp;

# Conclusion

We are at the end of the second article about __Iterators and Generators__. It's been a long way, hasn't it?

We have learnt all the nitty-gritty details about JavaScript generators: from the `yield` keyword to the generator delegation!

Next article will focus on __Asynchronous Iterators__, a recent feature brought to us by ES2018. Why we need them? What are the differences between them and sync iterators? We will answer all these questions.

I hope to see you there again 🙂 and on [twitter](https://twitter.com/jfet97)!

&nbsp;

# Acknowledgements

I would like to thank [Nicolò Maria Mezzopera](https://twitter.com/DonNicoJs) for helping me identify a lot of grammatical errors. If you are a __Vue.js__ developer, you need to check out his next workshop: [vueandme](https://vueand.me/).
I also wish to thank Gabriele Di Simone, Marco Terzolo and Giovanni Riga for the time they've spent to check the article.

&nbsp;

# Bibliography

* [ECMAScript 2019 specification](https://www.ecma-international.org/ecma-262/10.0/index.html)
* [You Don't Know JS](https://github.com/getify/You-Dont-Know-JS) series by Kyle Simpson
