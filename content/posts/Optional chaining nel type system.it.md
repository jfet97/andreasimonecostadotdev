+++
author = "Andrea Simone Costa"
title = "Optional chaining nel type system"
date = "2022-05-23"
description = "Vediamo quale è il corrispondente dell'optional chaining nel type system"
categories = ["typescript"]
series = ["TypeScript"]
published = false
tags = [
    "optional",
    "chaining",
    "never",
    "keyof",
]
featuredImage = "/images/optional_chaining/copertina.png"
images = ["/images/optional_chaining/copertina.png"]
+++

__Series__: [TypeScript](/it/series/typescript/)

# Introduzione

Rinfreschiamoci la memoria: che cosa è l'optional chaining? Quando abbiamo un oggetto con alcune proprietà che potrebbero essere `undefined`

L'optional chaining che prende forma nell'operatore `?.`, l'elvis operator per gli amici, ci permettere di leggere il valore di una proprietà in profondità in una chain di oggetti senza preoccuparci che ogni singola reference sia valida anziché `undefined`:

```ts
const customer = {
  name: "Carl",
  details: {
    age: 82,
    location: "Paradise Falls"
  }
};

const customerCity = customer.details?.address?.city; //  undefined
```

Il valore di ripiego, nel caso in cui la chain fallisca, è sempre `undefined`. Qualcosa di simile esiste anche nel type system, e in questo articolo andiamo a vedere di che si tratta.

# T[K & keyof T]