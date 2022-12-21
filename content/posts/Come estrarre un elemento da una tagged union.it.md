+++
author = "Andrea Simone Costa"
title = "Come estrarre un elemento da una tagged union"
date = "2022-12-19"
description = "Come estrarre un elemento da una tagged union"
categories = ["typescript"]
series = ["TypeScript"]
tags = [
    "union",
    "extract",
    "conditional type",
    "mapped type"
]
featuredImage = "/images/estrarre_da_unione/carbon.png"
images = ["/images/estrarre_da_unione/carbon.png"]
+++

&nbsp;

TypeScript ci permette di etichettare i vari elementi di una union per ottenere una _tagged union_, o _discriminated union_. Ad esempio, possiamo differenziare più forme assegnando ad ognuna un type literal dedicato.

```ts
type Shape = 
  | {
      _tag: "circle";
      radius: number;
    } 
  | {
      _tag: "square";
      side: number;
    }
  | {
      _tag: "rectangle";
      base: number;
      height: number;
    };
```

In gergo tecnico un tipo come `Shape` si chiama __sum type__. Questo perché l'insieme dei valori avente tale tipo è esattamente l'unione dei valori dei suoi costituenti e questi ultimi non hanno elementi in comune: sono disgiunti. Il discriminante, in questo esempio, è il field `_tag`, che deve essere unico per ogni componente di `Shape`.

Questo pattern ha innumerevoli vantaggi, tra i quali la possibilità di sfruttare le piene capacità di _code flow analysis_ e _type narrowing_ del linguaggio.

```ts
function getArea(shape: Shape): number {
  switch(shape._tag) {
    case "circle": {
      return Math.PI * shape.radius ** 2;
    }
    case "square": {
      return shape.side ** 2;
    }
    case "rectangle": {
      return shape.base * shape.height;
    }
  }
}
```

A seconda di quello che sarà il valore effettivo del field `_tag`, TypeScript è in grado di discriminare e rifinire il tipo di dell'argomento `shape` da `Shape` a uno dei tre suoi costituenti, permettendo quindi un accesso sicuro alle corrispondenti proprietà.

Ipotizziamo ora di voler quadrare un cerchio. Ovvero, vogliamo creare una funzione che prenda in ingresso esclusivamente un `"circle"` e restituisca un `"square"`. A disposizione abbiamo però solo il tipo `Shape`, non i suoi costituenti. Ci viene quindi in aiuto la type function `Extract`, disponibile nella stdlib dalla versione `2.8` di TypeScript.

```ts
// { _tag: "circle"; radius: number; }
type Circle = Extract<Shape, { _tag: "circle" }>;

// { _tag: "square"; side: number; }
type Square = Extract<Shape, { _tag: "square" }>;

function squareCircle(circle: Circle): Square {
  return {
    _tag: "square",
    side: Math.sqrt(getArea(circle)),
  }
}
```

[Playground](https://www.typescriptlang.org/play?#code/C4TwDgpgBAygFgQ0lAvFAsAKClAPlAbyxxKgH1gEBzALigCIBjASwCdGAbCegbmNKisEAE2YBXAM50AdmIC2AIwis+2EgF8Ma-ETWkK1OvQkBHMQlbdVAqBObCIM+UpX8c6-jrckDtBpcZKaSouXm8cBQQJRyhZRWVrATgIZio4YCd41z0odVUsADMxaUDmAHtpKCoIYABBSwQACglESDp4JAgASkyXQn4JAHdmYEY4ZtaIADpfLv6cxijoAHIWdi5lul0bS2AxVkqoAFkEYDgpgAUASSgAKltJqaFRSTv7gCZE929F6Khl0zmSybeY7Gr7Q4tTpTOwON5QT7eDwLJb-AJBEIQEHbAS7CE4KGQKaRP73QnTZKpdJfXL8ZHIrCgZAAYTYnGgaCgAFEAB7AISBAA8HUgABpCORKH4mGzQrkAHyqJnQGBmCwc7l8gXAYWTcUESWGBiA9X0BX5TBFErAcqVE2WVnrCCNNbsuiO9k9WBqyygwTgg5+nC+Iz27ii7ywmInM4wkysYCNap1Bou2XdLoRtT0rBYRgVCRlLhTDhlKjNH0QD1cRoGkMMV2hcXPcRSKAARnUXS6ucwyqgABUAKyoTX8hBChRlIsQBDScUFBAcaKKoA)

Come funziona? La definizione di `Extract` è la seguente:

```ts
type Extract<T, U> = T extends U ? T : never;
```

Essa prende in ingresso due type parameter, `T` e `U`, e utilizza un [conditional type](https://www.typescriptlang.org/docs/handbook/2/conditional-types.html) per verificare se `T` è assegnabile ad `U`. In caso positivo restituisce `T`, altrimenti restituisce `never`, il bottom type del linguaggio.

Vediamo qualche esempio semplice per capirne meglio il funzionamento.

```ts
// 10, perché 10 è assegnabile a number
type T0 = Extract<10, number>;

// true, perché true è assegnabile a boolean
type T1 = Extract<true, boolean>; 

// never, perché true non è assegnabile a false
type T2 = Extract<true, false>; 
```

Nel caso di tipi oggetto dobbiamo ricordare che TypeScript permette di assegnare un'entità di tipo `A` dove ne è richiesta una di tipo `B` se `A` ha __almeno__, e non esattamente, tutte le proprietà possedute da `B`, ovviamente del giusto tipo. Invece, il contrario non è ammesso.

```ts
// { n: number, s: string }, poiché esso ha almeno tutte le proprietà di { n: number }
type T3 = Extract<{ n: number, s: string }, { n: number }>;

// never
type T4 = Extract<{ n: number }, { n: number, s: string }>;
```

Ora veniamo al concetto più delicato: nel caso in cui `T` fosse una union entrerebbe in gioco la distribuzione rispetto all'unione del conditional type.

```ts
Extract<A | B, U>

// diventa

Extract<A, U> | Extract<A, B>
```

Questo perché nella definizione del conditional type interno a `Extract` si ha che il type parameter `T` è _naked_. La documentazione non fornisce una definizione precisa di questo attributo, ma in poche parole ogni volta che ci troviamo di fronte al pattern `T extends U ? X : Y` con `T` una type variable si ha in aggiunta che `T` è considerata naked. E se `T` è naked, allora il conditional si distribuisce rispetto all'unione.

```ts
(A | B) extends U ? X : Y

// diventa

(A extends U ? X : Y) | (B extends U ? X : Y)
```

Vediamo quindi qualche esempio.

```ts
// false
type T5 = Extract<boolean, false>;

// { _tag: "circle"; radius: number; }
type T6 =  Extract<Shape, { _tag: "circle" }>;
```

`T5` risulta `false` poiché `boolean` viene espanso in `true | false` e per la distribuzione rispetto all'unione `Extract<true | false, false>` è pari a `Extract<true, false> | Extract<false, false>` ovvero `never | false` ovvero `false`, in quanto `never` è l'elemento neutro dell'unione (`never` corrisponde sostanzialmente all'insieme vuoto).

`T6` risulta `{ _tag: "circle"; radius: number; }` poiché `Shape` viene espanso nei tre costituenti ed `Extract` si distribuisce rispetto a tale unione, ma solo uno dei tre elementi, ovvero `{ _tag: "circle"; radius: number; }`, è assegnabile al tipo `{ _tag: "circle" }`, per quanto detto prima sulle regole di assegnabilità.

```ts
Extract<Shape, { _tag: "circle" }>

// diventa

Extract<
  | { _tag: "circle"; radius: number; }
  | { _tag: "square"; side: number; }
  | { _tag: "rectangle"; base: number; height: number; },
  { _tag: "circle" }
>

// diventa

| Extract<{ _tag: "circle"; radius: number; }, { _tag: "circle" }>
| Extract<{ _tag: "square"; side: number; }, { _tag: "circle" }>
| Extract<{ _tag: "rectangle"; base: number; height: number; }, { _tag: "circle" }>

// diventa

| { _tag: "circle"; radius: number; }
| never // _tag: "square" non assegnabile a _tag: "circle"
| never // // _tag: "rectangle" non assegnabile a _tag: "circle"

// diventa

{ _tag: "circle"; radius: number; }
```
