+++
author = "Andrea Simone Costa"
title = "Do Vue 3 refs admit a monad instance?"
date = "2020-07-30"
description = "After an initial overview about the possibility of Vue 3 refs admitting a monad instance, I present useSwitchMap: a rxjs-like switchMap for refs."
categories = ["javascript", "vue"]
tags = [
    "refs",
    "compositions",
    "monads",
]
featuredImage = "/images/vue-refs-monad/1.png"
images = ["/images/vue-refs-monad/1.png"]
+++

# tl;dr

After an initial discussion about the possibility of refs admitting a monad instance, I present a function, `useSwitchMap`, that helps compose a ref with a function from values to refs.

Another rising need in the Vue 3 ecosystem is the possibility to compose a ref with a function from values to objects containing refs, and `useSwitchMapO` will do the trick.
&nbsp;

# Why monads?

One of the main benefits of monads is the composition ability they provide.
Let's say we have a certain `M<A>`, where `A` is whatever type you want and `M` is the much feared (and misunderstood) effect/context/computation/burrito. Monads let us combine that `M<A>` with a function `A -> M<B>`, that is a function that takes an `A` without context and produces a `B` "inside" that context.

It's not just a matter of discarding the `M` from `M<A>`.
I would like to mention the following paragraph from [https://wiki.haskell.org/Monad](https://wiki.haskell.org/Monad): "Each monad...[let us to] combine a computation description with a _reaction_ to it: a pure function that is set to receive a computation-produced value (when and if that happens) and return another computation description, using or dependent on that value if need be, creating a description of a combined computation that will feed the original computation's output through the reaction _while automatically taking care of the particulars of the computational process itself_".

Therefore, we can say that `M<A>` describes a computation, so when we __bind__ it to a function `A -> M<B>` the monad will take care of the meaning of such a composition. Monads help us abstract away that composition logic.
Moreover, a lot of computations with or without side effects can be described using monads.

In the functional programming realm each program can be seen as a function `A -> M<B>`. Monads help us compose such programs, because if you are able to compose `M<A>` with `A -> M<B>`, you even know how to compose `C -> M<A>` with `A -> M<B>`.
&nbsp;

# What do refs have to do with monads?

In Vue 3 there is this new __ref__ concept: a special type of data structure with reactive capabilities.
Here is a brief introduction:

```js
import { ref, computed } from "vue"

const numRef = ref(0)
// numRef.value === 0

const stringNumRef = computed(() => String(numRef.value))
// stringNumRef.value === '0'

numRef.value = 10;
// numRef.value === 10

console.log(stringNumRef.value) // log '10'
```

Please refer to [the documentation](https://composition-api.vuejs.org/#api-introduction) for more information.

We could say that the `M` in `M<A>` is the ref data structure itself. Anyway, some conditions have to be met in order to properly define a monad instance.

## return

We need the ability of lifting any value of type `A` into a monadic value of type `M<A>`. The `ref` function serves the purpose:

```js
import { ref } from "vue"

const numRef = ref(0)
```

## bind

It maps the monadic type `M<A>` to the monadic type `M<B>` given a monadic function of type `A -> M<B>` (aka a common Vue 3 composition function).
Vue 3 does not provide a bind function by default, so I wrote the one that seemed  the most reasonable to me. We'll discuss it later:

```js
import { useSwitchMap } from "vue-use-switch-map"

function useSomething(v:A): M<B> {
    // a function that takes a plain value of type A
    // and produces a ref of type B
}

const numRef = ref(0) // M<A>

const switchMappedRef = useSwitchMap(numRef, useSomething)
// see how a value of type M<A> is composed with
// a function of type A -> M<B>
```

There could be other bind implementations in addition to `useSwitchMap`, which could cause the composition to behave differently. Therefore, it could be possible to try to define more than one monad instance for refs.

## left identity and right identity

These two laws state that the only thing the return function is allowed to do is to lift a value inside the monadic context, without manipulating the value in any way:

```js
useSwitchMap(ref(x), useSomething) === useSomething(x)

useSwitchMap(aRef, ref) === aRef
```

## associativity

In the first case, we apply two functions, `useSomething` and `useSomethingElse`, in two separated steps. In the second case, we compose the functions first and then apply the result.
There must be no difference between them:

```js
useSwitchMap(
    useSwitchMap(
        aRef,
        useSomething
    ),
    useSomethingElse
)
===
useSwitchMap(
    aRef,
    (value) => useSwitchMap(
        useSomething(value),
        useSomethingElse
    )
),
// here we have composed (value) => useSomething(value) aka useSomething
// with useSomethingElse
```

## do refs admit a monad instance?

Unfortunately, there are some compromises.

Because of the reactive needs of Vue web applications, there is not a clear dividing line between the side-effecting monad ref and its use. In a way, it's like having the ability to call an `IO` action whenever and wherever we want.

In general, having a reference to a ref (pun not intended) lets you use its reactive properties, potentially producing a lot of side effects. For example, having the possibility to access the `ref(x)` used in `useSwitchMap(ref(x), useSomething)` might cause changes in the ref returned by `useSwitchMap`, by changing the `ref(x)` value.
On the contrary, the direct use of  `useSomething` in `useSomething(x)` does not allow such a thing:

```js
const r = ref(x)
const s = useSwitchMap(r, useSomething)

// I'm able to change r.value triggering a change in s
```

Only if changing `r.value` was not possible (like an `IO` action cannot be called) it would be safe to substitute the previous two lines with:

```js
const s = useSomething(x)
```

But in this case refs would stop being useful at all.

Therefore, I don't think all laws strictly hold. Or at least, I'm not sure.

## composition

Anyhow, the need of composing a `M<A>`, where `M` is `ref`, with a function `A -> M<B>` remains. Maybe refs do not admit any monad instance, but monads teach us how to abstract the composition process, so we can follow their advice.
&nbsp;

# useSwitchMap

As previosuly stated, this function is a possible way to implement the monadic __bind__. It takes a ref and a function from values to refs, returning in turn a ref.

What is the composition logic that is abstracted away? If you know the switchMap operator from RxJS, you already have the answer.
If not, here it is:
&nbsp;

![RxJS SwitchMap Operator](https://rxjs-dev.firebaseapp.com/assets/images/marble-diagrams/switchMap.png)
Now, we can move on.

I'm joking, let me explain it: switchMap returns an Observable that emits items based on applying a function that you supply to each item emitted by the source Observable, where that function returns an (so-called "inner") Observable. Each time it observes one of these inner Observables, the output Observable begins emitting the items emitted by that inner Observable. When a new inner Observable is emitted, switchMap stops emitting items from the earlier-emitted inner Observable and begins emitting items from the new one. It continues to behave like this for subsequent inner Observables.

I'm joking again, sorry. That was [from here](https://rxjs-dev.firebaseapp.com/api/operators/switchMap), if you are really curious about the RxJS switchMap operator.

The `useSwitchMap` will return a ref that will see its value changed because of two main reasons: the composed function changes its returned ref's value, or the input ref's value has been changed.
The first case is not special at all, I'm sure you already use some Vue 3 composition functions that internally listen to some events, or use some timeouts, promises, etc. and therefore change the ref's value they return in response to those happenings.
The second case is more tricky, because a lot of stuff happens when the input ref's value is changed. The composed function is re-runned from scratch, producing a new ref. This ref is automagically substituted to the one that `useSwitchMap` has returned. Do you see the switch?

## easy example: multiples of a number

Let's say we have a numeric ref that should be combined with a function that produces the next multiple of a number every 500ms.
If we increase the value of `counterRef`, the result of this composition should be updated as well and the emission of its multiples should start from scratch. That means that the function must run again.

Here it is:

```js
const counterRef = ref(0)

const switchMappedRef = useSwitchMap(counterRef, (value) => {
    const multRef = ref(value)

    setInterval(() => {
        multRef.value = value + multRef.value
    }, 500)

    return multRef
})
```

Even if we have not cleaned up the interval at all, the magic 🌈 of `useSwitchMap` will take care of ignoring the updates performed on the previous versions of `multRef`, in such a way that `switchMappedRef` receives only the ones from the last `multRef` produced.

P.S. If you, dear reader, are a Vue core team member, please enhance the reactive API to let me remove all the collected watchers of a certain ref 😂.

Anyway, we need a way to perform some cleanup inside the function, just before `useSwitchMap` calls it again. For example, we want to remove previous intervals.
To be able to do this I had to make another compromise: the function from values to refs will receive another function as parameter, to be able to register a cleanup callback:

```js
const counterRef = ref(0)

const switchMappedRef = useSwitchMap(counterRef, (value, cleanup) => {
    const multRef = ref(value)

    const interval = setInterval(() => {
        multRef.value = value + multRef.value
    }, 500)

    cleanup(() => clearInterval(interval)) // <--

    return multRef
})
```

## useless example: mouse tracker

We want to track all the pointer positions after an initial click that starts the tracking. We want to be able to restart the tracking from scratch at each click.

Here it is:

```js
// click handling
const mouseClickPoisitonRef = ref({ x: -1, y: -1 })

function updateMouseCLickPositionRef(x, y) {
    mouseClickPoisitonRef.value.x = x
    mouseClickPoisitonRef.value.y = y
}

const clickListener = clickEvent => {
    updateMouseCLickPositionRef(
        clickEvent.screenX,
        clickEvent.screenY
    )
}

// each time we click, mouseClickPoisitonRef is updated
window.addEventListener("click", clickListener)


// positions tracking
const switchMappedRef = useSwitchMap(
    mouseClickPoisitonRef,
    (initP, cleanup) => {
        
        // do nothing until we click
        if(initP.x === -1) return ref([])

        const psRef = ref([{ x: initP.x, y: initP.y }])

        const moveListener = moveEvent => {
          psRef.value.push({
            x: moveEvent.screenX,
            y: moveEvent.screenY
          });
        };

        // add the new position inside the positions array ref
        window.addEventListener("mousemove", moveListener)

        cleanup(() => window.removeEventListener(
           "mousemove",
           moveListener
        ))

        return psRef
    }
)
```

You can try it [here](https://codesandbox.io/s/epic-tree-ddlho)<sup>*</sup> 😃.
&nbsp;

# useSwitchMapO

A bind function like `useSwitchMap` is not enough in the case the composed function returns an object where each property is itself a ref. Unfortunately, we can no longer perform a bind operation because the result of such a function is no more a `M<B>`.

We could argue if such an object could admit a monad instance, but it doesn't seem very useful to me.
I think the ability to compose a ref with a function from values to an object of refs is more useful, and this is why `useSwitchMapO` was born. Refs are a primitive of the Vue 3 lang, and pretty much everything can become a ref.

## serious use case: fetch

Our goal is to compose the following `useFetch` Vue composition function with a ref, so that each time the ref is changed the function will refetch the data. This `useFetch` function will return an object containing three refs: one that signals if the fetch is in a pending state, one for the resulting data and the last for a possible error message.

Using `useSwitchMapO` will be a breeze:

```js
import { useSwitchMapO } from "vue-use-switch-map"
import { ref, computed } from "vue"


const useFetch = (url) => {
    const dataRef = ref(null)
    const errorMessageRef = ref("")
    const isPendingRef = ref(true)

    fetch(url)
        .then(response => response.json())
        .then(data => dataRef.value = data)
        .catch(error => errorMessageRef.value = error.message)
        .finally(() => (isPendingRef.value = false))  

    return { dataRef, errorMessageRef, isPendingRef } 
}


// for example, counterRef could be a prop
const counterRef = ref(0)

function incrementCounterRef() {
    counterRef.value++;
}

const urlRef = computed(
    () => `https://jsonplaceholder.typicode.com/todos/${counterRef.value}`
)

// here it is
const { dataRef, errorMessageRef, isPendingRef } = useSwitchMapO(
    urlRef,
    useFetch
)
```

You can try it [here](https://codesandbox.io/s/suspicious-lederberg-bskte)<sup>*</sup> 🙂.

As you can see, we don't have to worry about older fetch calls that may take longer than the last one, with the risk of having our `dataRef`, `errorMessageRef` and `isPendingRef` changed by them.
That's because `useSwitchMapO` is magic enough, like the `useSwitchMap` 🦄🦄🦄.

Moreover, you can always use the `cleanup` function argument to set up a cleaup function, e.g. to stop an asynchronous computation:

```js
const useFetch = (url, cleanup) => {
    const dataRef = ref(null)
    const errorMessageRef = ref("")
    const isPendingRef = ref(true)

    const controller = new AbortController();
    const signal = controller.signal;

    fetch(url, { signal })
        .then(response => response.json())
        .then(data => dataRef.value = data)
        .catch(error => errorMessageRef.value = error.message)
        .finally(() => (isPendingRef.value = false))

    cleanup(() => controller.abort()) // <--

    return { dataRef, errorMessageRef, isPendingRef } 
}
```

In this case, though, the promise will reject with an AbortError, so the magic of `useSwitchMapO` is still needed to prevent the problems we have just discussed.
&nbsp;

# import { useSwitchMap, useSwitchMapO } from 'vue-use-switch-map'

I've created this little package that you can install with:

```sh
npm i -S vue-use-switch-map
```

It exports two functions: `useSwitchMap` and `useSwitchMapO`.

It should work with both Vue 3 and Vue 2 + `@vue/composition-api` because I'm using [vue-demi](https://github.com/antfu/vue-demi), and it is written in TypeScript.

I've tried my best to test it, but I clearly suck at it. I've messed a lot with jest, fake timers and watchers without much success, therefore I was unable to express some advanced use cases that I had to personally test using home made solutions.
Therefore, any contribution in this direction is really really appreciated 😊.

Here it is the GitHub repo of [vue-use-switch-map](https://github.com/jfet97/vue-use-switch-map) 👽.
__\#star4star__ __\#noreduce__ __\#repooftheday__
&nbsp;

# Final thoughts

I'd like to say that Vue 3 refs admit a monad instance, but for now I cannot state it. I hope that some Vue && fp expert might help, further clarifying the situation.

In any case it is possible to let monads and the monadic binding influence how we compose functions that return refs, allowing us to abstract away the composition logic that does not depend from the ref itself. All that opens up amazing possibilities!

Oh, if you want to yell at me because [fill the blanket], then you can do it also on twitter: [@JFieldEffectT](https://twitter.com/JFieldEffectT)

\* <sub><sup>I've faced some problems using Vue 3 with CodeSandbox, so if it is all freezed after the compilation try to play around || refresh the browser || refresh the codesandbox inner browser until it works. Or you can download it and run the example on your local machine.</sup></sub>
