+++
author = "Andrea Simone Costa"
title = "Optional chaining nel type system"
date = "2022-05-23"
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

L'interfaccia `UserAPI` contiene, per ogni endpoint, i tipi delle richieste e delle risposte per i metodi HTTP che uno specifico endpoint supporta.

Ipotizziamo ora di voler tipizzare il tipo di ritorno della seguente funzione:

```ts
declare function extractPostRequest<Path extends keyof UserAPI>(api: UserAPI, path: Path): unknown {
  return (api[path] as any).post?.request
}
```

la quale, data una istanza di `UserAPI` e un `path` chiave di `UserAPI`, estrae la request del metodo POST, a patto che tale metodo venga supportato dall'endpoint corrispondente al `path`.

Potremmo essere tentati di fare così:

```ts
declare function extractPostRequest<Path extends keyof UserAPI>(api: UserAPI, path: Path): UserAPI[Path]["post"]["request"]
```

ma TypeScript ci ferma: `"post"` non appartiene alle chiavi di `UserAPI[Path]` dato che vi sono alcuni `Path` non contenenti alcuna chiave `"post"`.

# La soluzione

## OptionalLookup

```ts
type OptionalLookup<T, K extends PropertyKey> = T[K & keyof T]
```


https://www.typescriptlang.org/play?ts=4.7.0-beta#code/JYOwLgpgTgZghgYwgAgKIgCYAcD2owA8AShAI4CuEAzmADTIlW4hUQB8yA3gFDLJRlKNAFwNB1MAG5e-as1ajG8iNIC+3bvmjwkyAKqsoXGSDgBbCKJpRQAc2l84ty8hDkzAI2gPkwDFbAbEHtudU1wbUQUA2gAQQAFAEljPgAiAHpyQypU0R4+PmcwUXRsPHACNwAbKvoYqABtAF02Hz5cETRMXHwCAHkzYEJ6+lS-VLY6w1aZVR8MrOgqdOFFqESMXJSCopLu8sJq2v1ptuQsODAEAAs9st74uCgwYDgq-sHhw1HxtkmT6AzPhzUIaMAATywKD6WBeOFMVQAMjgcABrchYAgAFXoAGlkBAAB6QTBUZDxKA4KHPcG4iDgjgAXmQWIa+IAZMhUfScDAWU0wZCUJAaMhmTC4QjkWiMf1YcB4W9pejMfUEokGgtsis1htUk1Rh0wBNRgImPDWBMNBgIAgqk8UDByCAEJKCcSoIgwPEcDQSBQJARHmBru6SRgydzwbyAVB1WwABRwLDAURqpL0C4h0TB64ASlEEoVUpRKrlkqVpdl6Y1uYNyFSRpNDYEAZoVu4NrtDuQCAtYGQa3VacM6u4RMCXp9fvENATQ4zDcy2VSefHHqnvrA-qEYHno8XWqWOsMerzQA