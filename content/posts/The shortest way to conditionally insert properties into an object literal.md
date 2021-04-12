+++
author = "Andrea Simone Costa"
title = "The shortest way to conditionally insert properties into an object literal"
date = "2019-03-27"
description = "Conditionally adding properties into an object could be done in many ways. This article explain why and how the shortest known solution works!"
tags = [
    "javascript",
    "objects",
    "beginners",
    "specification",
]
+++

What am I ranting about?
I'm talking about this:
```js
const obj = {
    ...condition && { prop: value },
};
```
Trust me, this is perfectly acceptable and executable JavaScript.

Surprised? Shaken up? Aghast? Maybe just intrigued?
Bear with me for few lines, I'll try to explain what's going on thanks to the ECMAScript Language Specification.
It won't be so boring, I `new Promise()`.

## Example
I'll start with an example to clarify the situation. 
Here a weird and not to be imitated at home `query` object is being constructed taking values from the result of a form previously submitted.
Only two fields are mandatory: the requested _collection_ and the _sort ordering_, which for simplicity are hardcoded.
On the contrary, the _state_ and the _priority_ could be absent in the `formValues` object, so they should be conditionally inserted into the `query` object.

```js
const state = formValues['state'];
const priority = formValues['priority'];

const query = {
    collection: 'Cats',  
    sort: 'asc',

    ...state && { state },
    ...priority && { priority },
};

await doQuery(query);
```
If the `formValues` object doesn't own one or more of the conditional properties, not even the resulting `query` object will have it/them.

## Explanation

### An insight into the spec

When such a case is encountered by a JavaScript engine, the spec leaves no room for doubt. [Here](https://tc39.github.io/ecma262/#sec-object-initializer-runtime-semantics-propertydefinitionevaluation) we can see that the `CopyDataProperties` abstract operation has to be performed.
Performed on what? Why parenthesis are not needed? What is an abstract operation?

One thing at a time, dear reader.

Following the same link, four lines above, we can see that whatever follows the spread operator, it must be an `AssignmentExpression`. No need for parenthesis. What is an `AssignmentExpression`? It could be [many things](https://tc39.github.io/ecma262/#prod-AssignmentExpression), also an arrow function! However, our case is based on a simple `ConditionalExpression`.

The spec says the expression should be evaluated and the result must be fed to the `CopyDataProperties` abstract operation. Therefore, properties will be copied from the result of the evaluation to the object literal on which we are working.

Now we can define what is an abstract operation: a list of tasks performed internally by the JavaScript engine. Later we will focus more on those that compose the `CopyDataProperties` abstract operation.

Let's recap what we learned so far:
1. the conditional expression will be immediately evaluated
2. the result of that evaluation will be taken by the `CopyDataProperties` abstract operation, which is responsible of the properties cloning and insertion 

### The logical && operator

Let's focus on the conditional expression.

The value produced by the __&&__ operator will always be the value of one of the two operand expressions. It is not necessarily of type Boolean.
If the first operand results in a truthy value, the __&&__ expression results in the value of the second operand. If the first operand results in a falsy value, the __&&__ expression results in the value of the first operand.

```js
let expr1 = 'foo';
let expr2 = null;
let expr3 = 42;

// the first operand is a truthy value -> the second operand is the result
expr1 && expr2;    // null
expr1 && expr3;    // 42

// the first operand is a falsy value -> the first operand is the result
expr2 && expr1;    // null
expr2 && expr3;    // null

```

Therefore, what if our _condition_ is a __truthy__ value? We could transform the initial code:
```js
const obj = {
    ...condition && { prop: value },
};
```
into:
```js
const obj = {
    ...{ prop: value },
};
```
We don't need to know what will the `CopyDataProperties` abstract operation do to understand the final result: the inner object will be spreaded and its property will be cloned into `obj`.

On the contrary, what if our _condition_ is a __falsy__* value? We run in the following situation:
```js
const obj = {
    ...condition,
};
```
And here's where things get interesting.

### The CopyDataProperties abstract operation

[Here](https://tc39.github.io/ecma262/#sec-copydataproperties) we can see what are the steps followed by the abstract operation.

The point number __3__ says something newsworthy: if a __null__ value or an __undefined__ value will be encountered, no operation will be performed.
So we can end up in the situation where the _condition_ results into __null__ or __undefined__ with no problems:
```js
const obj = {
    ...null,
};
```
and:
```js
const obj = {
    ...undefined,
};
```
are equivalent to:
```js
const obj = {
};
```

If we jump to the points number __5__ and __6__ we can see that each own property will be cloned if our _condition_ would result into an object. We know that all the objects are truthy values, also empty ones, so at the moment we can ignore this case. In fact, do you remember what happen if the _condition_ would be a truthy value?

Finally, what if the _condition_ results into one of the remaining falsy primitive values?
Focus on the point number __4__. Do you see the intervention of the `toObject` abstract operation? Let's [take a look](https://tc39.github.io/ecma262/#sec-toobject)!
We can ignore the first two cases because we already know that the `CopyDataProperties` abstract operation ends before in such situations.
The last case assures us that if the argument is already an object, no harm will be done to it. But even this cannot happen.
Instead, what happens if the argument is one of __Boolean__, __String__, and __Number__? Simple: it will autoboxed into [the corrispondent wrapper object](https://github.com/getify/You-Dont-Know-JS/blob/master/types%20%26%20grammar/ch3.md#boxing-wrappers).

It is worth noting that, in our case, the resulting wrapper objects have no own properties. Boolean and Number wrapper objects store their value into an internal, and inaccessible, property. On the contrary String wrappers do expose the contained characters (read-only), but remember that only an empty string is a falsy value.
No own properties means the end of the `CopyDataProperties` abstract operation, which will have no properties to clone.

So we can transform the last partial result:
```js
const obj = {
    ...condition,
};
```
into:
```js
const obj = {
    ...{},
};
```
Without any side effect!

## Conclusion
I hope I was able to explain everything in the best possible way 😃

English is not my mother tongue, so errors are just around the corner.
Feel free to comment with corrections!
I hope to see you there again 🙂 and on [twitter](https://twitter.com/JFieldEffectT)!


\* <sub><sup>One of false, 0, empty string, null, undefined and NaN</sub></sup>.

