+++
author = "Andrea Simone Costa"
title = "Optional chaining nel type system"
date = "2022-05-25"
description = "Vediamo quale è il corrispondente dell'optional chaining nel type system"
categories = ["typescript"]
series = ["TypeScript"]
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

Rinfreschiamoci la memoria: che cosa è l'optional chaining? L'optional chaining prende forma nell'operatore `?.`, l'elvis operator per gli amici, e ci permettere di leggere il valore di una proprietà in profondità in una chain di oggetti senza preoccuparci che ogni singola reference sia valida:

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

# Il problema

Ipotizziamo di trovarci nella seguente situazione:

```ts
interface Endpoint<Request, Response> {
  request: Request;
  response: Response;
}

interface User {
  name: string;
  age: number;
  id: string;
}

interface UserAPI {
  "/users": {
    get: Endpoint<null, User[]>;
    post: Endpoint<Omit<User, "id">, User>;
  };
  "/users/:userId": {
    get: Endpoint<null, User>;
    patch: Endpoint<Partial<Omit<User, "id">>, User>;
  };
}
```

L'interfaccia `UserAPI` contiene, per ogni endpoint, i tipi delle richieste e delle risposte per i metodi `HTTP` che uno specifico endpoint supporta.

Ipotizziamo ora di voler tipizzare il tipo di ritorno della seguente funzione:

```ts
declare function extractPostRequest<Path extends keyof UserAPI>(api: UserAPI, path: Path): unknown
```

la quale, data una istanza di `UserAPI` e un `path` chiave di `UserAPI`, estrae la request del metodo `POST`, a patto che tale metodo venga supportato dall'endpoint corrispondente al `path`.

Potremmo essere tentati di fare così:

```ts
declare function extractPostRequest<Path extends keyof UserAPI>(api: UserAPI, path: Path): UserAPI[Path]["post"]["request"]
```

ma TypeScript ci ferma: `"post"` non appartiene alle chiavi di `UserAPI[Path]` dato che vi sono alcuni `Path` non contenenti alcuna chiave `"post"`.

# La soluzione

### OptionalLookup

```ts
type OptionalLookup<T, K extends PropertyKey> = T[K & keyof T]
```

Vi sono innanzitutto alcune proprietà importanti da tenere presenti:

1. per ogni tipo `T` diverso da `any` si ha che `T[never] = never`
2. per ogni tipo `K` assegnabile a `string | number | symbol` si ha che `never[K] = never`
3. per ogni tripla di tipi `A`, `B` e `C` si ha che `(A | B) & C = (A & C) | (B & C)`, ovvero l'intersezione si distribuisce rispetto all'unione
4. per ogni coppia di tipi `A` e `B` si ha che se non esistono valori assegnabili sia ad `A` che a `B` allora `A & B = never`
5. per ogni tipo `A` si ha che `A | never = A`

Analizziamo ora la semantica della type function `OptionalLookup`. Per le proprietà `3`, `4` e `5` se la generica chiave `K` è assegnabile a `keyof T` allora `K & keyof T` si riduce semplicemente a `K`, altrimenti si riduce a `never`. Perciò nel primo caso avremmo che `OptionalLookup<T, K> = T[K]`, cioè si comporta come il normale lookup, mentre nel secondo caso avremmo che `OptionalLookup<T, K> = T[never] = never` grazie alla proprietà `1`. Infine, per la proprietà `2` abbiamo che `OptionalLookup` può essere innestato a piacimento anche nel caso in cui il lookup fallisca nel tipo `never`:

```ts
type obj = {
  prop1: {
    innerProp1: number,
    innerProp2: string,
  },
  prop2: boolean[]
}

type test1 = OptionalLookup<obj, "prop1"> // { innerProp1: number; innerProp2: string; }
type test2 = OptionalLookup<OptionalLookup<obj, "prop1">, "innerProp1"> // number
type test3 = OptionalLookup<obj, "prop3"> // never
type test4 = OptionalLookup<OptionalLookup<obj, "prop1">, "innerProp3"> // never
type test5 = OptionalLookup<OptionalLookup<obj, "prop3">, "whatever"> // never
```

[Playground](https://www.typescriptlang.org/play?ts=4.7.0-beta#code/C4TwDgpgBA8mwEsD2A7AhgGwDJKQawFcwAeAFQBooBpKCAD2AhQBMBnKABQCclIvQqEEAD4oAXiikA2jQBkUPEKQAzSQF0AUBtCQoSAEYArcVADeGqFDA8wARgBcZi5agIUKCF268HUFAQBbfU9yZ0s3Dy8bACZHVmAuNwBzUMsAX1SrGMd9XAwINBQpTTStHWhGeNsTOERUTBx8ImIDQ0oAImsfdtEAel6zV3dPbztHfyDPAG4hyNHYqHjElCSZ0v6XSwA9AH5tcAqIeOia+GR0bFxCElrzhqvm1o6uux6OiJGbWx6oDYngrgaDabXb7XSVYAAZlOdQujWuLSMzxskJ+fwgADdPECBiC9uUoBCACwwu6XJo3M71ckIp5QTpfN70j5RXiovoDDxYwHAlyggkQgCspOp8Oat1FDxIdIZbKZ7QA7gALNCMblozmY7G87Y7IA)

&nbsp;

Possiamo quindi tipizzare la funzione `extractPostRequest` nel seguente modo:

```ts
declare function extractPostRequest<Path extends keyof UserAPI>(
  api: UserAPI,
  path: Path
): OptionalLookup<OptionalLookup<UserAPI[Path], "post">, "request">;

declare const userAPI: UserAPI
extractPostRequest(userAPI, "/users") // Omit<User, "id">
extractPostRequest(userAPI, "/users/:userId") // never
```

In questo modo se il `path` corrisponde ad un endpoint che supporta il metodo `POST` allora il tipo di ritorno sarà il tipo della `request` corrispondente, altrimenti sarà `never`. Una possibile implementazione di `extractPostRequest` potrebbe infatti decidere di lanciare una eccezione nel caso in cui il `path` non supporti il metodo `POST`, e `never` è il tipo di ritorno corretto da scegliere per questa evenienza.

[Playground](https://www.typescriptlang.org/play?ts=4.7.0-beta#code/JYOwLgpgTgZghgYwgAgKIgCYAcD2owA8AShAI4CuEAzmADTIlW4hUQB8yA3gFDLJRlKNAFwNB1MAG5e-as1ajG8iNIC+3bvmjwkyAKqsoXGSDgBbCKJpRQAc2l84ty8hDkzAI2gPkwDFbAbEHtudU1wbUQUA2gAQQAFAEljPgAiAHpyQypU0R4+PmcwUXRsPHACNwAbKvoYqABtAF02Hz5cETRMXHwCAHkzYEJ6+lS-VLY6w1aZVR8MrOgqdOFFqESMXJSCopLu8sJq2v1ptuQsODAEAAs9st74uCgwYDgq-sHhw1HxtkmT6AzPhzUIaMAATywKD6WBeOFMVQAMjgcABrchYAgAFXoAGlkBAAB6QTBUZDxKA4KHPcG4iDgjgAXmQWIa+IAZMhUfScDAWU0NBgIAgqk8UDByCAEHCQATiVBEGB4jgaCQKBICI8wNc5SSMGTueDeQCoAlEmwABQyOBYYCiepm2gyC7a0Ra67cACUohhMreyLRGP6sOA8P9KPRmIdSQa7qaow6YAmowE6poE2kguFooEyAQ8JoyDWZvthjN3CJgUVytV4hoFuLSVGmWyqU9yHS6WQAyGBBGyDGmzYFfl1ZVYDVQjADbLTYHLaWKzWGzbHa7IAgADdoEA)