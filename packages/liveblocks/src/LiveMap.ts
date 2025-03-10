import { AbstractCrdt, Doc, ApplyResult } from "./AbstractCrdt";
import {
  deserialize,
  isCrdt,
  selfOrRegister,
  selfOrRegisterValue,
} from "./utils";
import {
  Op,
  CreateMapOp,
  OpType,
  SerializedCrdtWithId,
  CrdtType,
} from "./live";

/**
 * The LiveMap class is similar to a JavaScript Map that is synchronized on all clients.
 * Keys should be a string, and values should be serializable to JSON.
 * If multiple clients update the same property simultaneously, the last modification received by the Liveblocks servers is the winner.
 */
export class LiveMap<TKey extends string, TValue> extends AbstractCrdt {
  #map: Map<TKey, AbstractCrdt>;

  constructor(
    entries?: readonly (readonly [TKey, TValue])[] | null | undefined
  ) {
    super();
    if (entries) {
      const mappedEntries: Array<[TKey, AbstractCrdt]> = [];
      for (const entry of entries) {
        const value = selfOrRegister(entry[1]);
        value._setParentLink(this, entry[0]);
        mappedEntries.push([entry[0], value]);
      }

      this.#map = new Map(mappedEntries);
    } else {
      this.#map = new Map();
    }
  }

  /**
   * INTERNAL
   */
  _serialize(parentId?: string, parentKey?: string): Op[] {
    if (this._id == null) {
      throw new Error("Cannot serialize item is not attached");
    }

    if (parentId == null || parentKey == null) {
      throw new Error(
        "Cannot serialize map if parentId or parentKey is undefined"
      );
    }

    const ops = [];
    const op: CreateMapOp = {
      id: this._id,
      type: OpType.CreateMap,
      parentId,
      parentKey,
    };

    ops.push(op);

    for (const [key, value] of this.#map) {
      ops.push(...value._serialize(this._id, key));
    }

    return ops;
  }

  /**
   * INTERNAL
   */
  static _deserialize(
    [id, item]: SerializedCrdtWithId,
    parentToChildren: Map<string, SerializedCrdtWithId[]>,
    doc: Doc
  ) {
    if (item.type !== CrdtType.Map) {
      throw new Error(
        `Tried to deserialize a map but item type is "${item.type}"`
      );
    }

    const map = new LiveMap();
    map._attach(id, doc);

    const children = parentToChildren.get(id);

    if (children == null) {
      return map;
    }

    for (const entry of children) {
      const crdt = entry[1];
      if (crdt.parentKey == null) {
        throw new Error(
          "Tried to deserialize a crdt but it does not have a parentKey and is not the root"
        );
      }

      const child = deserialize(entry, parentToChildren, doc);
      child._setParentLink(map, crdt.parentKey);
      map.#map.set(crdt.parentKey, child);
    }

    return map;
  }

  /**
   * INTERNAL
   */
  _attach(id: string, doc: Doc) {
    super._attach(id, doc);

    for (const [key, value] of this.#map) {
      if (isCrdt(value)) {
        value._attach(doc.generateId(), doc);
      }
    }
  }

  /**
   * INTERNAL
   */
  _attachChild(id: string, key: TKey, child: AbstractCrdt): ApplyResult {
    if (this._doc == null) {
      throw new Error("Can't attach child if doc is not present");
    }

    const previousValue = this.#map.get(key);
    let reverse: Op[];
    if (previousValue) {
      reverse = previousValue._serialize(this._id!, key);
      previousValue._detach();
    } else {
      reverse = [{ type: OpType.DeleteCrdt, id }];
    }

    child._setParentLink(this, key);
    child._attach(id, this._doc);
    this.#map.set(key, child);

    return { modified: this, reverse };
  }

  /**
   * INTERNAL
   */
  _detach() {
    super._detach();

    for (const item of this.#map.values()) {
      item._detach();
    }
  }

  /**
   * INTERNAL
   */
  _detachChild(child: AbstractCrdt) {
    for (const [key, value] of this.#map) {
      if (value === (child as any)) {
        this.#map.delete(key);
      }
    }

    child._detach();
  }

  /**
   * Returns a specified element from the LiveMap.
   * @param key The key of the element to return.
   * @returns The element associated with the specified key, or undefined if the key can't be found in the LiveMap.
   */
  get(key: TKey): TValue | undefined {
    const value = this.#map.get(key);
    if (value == undefined) {
      return undefined;
    }
    return selfOrRegisterValue(value);
  }

  /**
   * Adds or updates an element with a specified key and a value.
   * @param key The key of the element to add. Should be a string.
   * @param value The value of the element to add. Should be serializable to JSON.
   */
  set(key: TKey, value: TValue) {
    const oldValue = this.#map.get(key);

    if (oldValue) {
      oldValue._detach();
    }

    const item = selfOrRegister(value);
    item._setParentLink(this, key);

    this.#map.set(key, item);

    if (this._doc && this._id) {
      const id = this._doc.generateId();
      item._attach(id, this._doc);
      this._doc.dispatch(
        item._serialize(this._id, key),
        oldValue
          ? oldValue._serialize(this._id, key)
          : [{ type: OpType.DeleteCrdt, id }],
        [this]
      );
    }
  }

  /**
   * Returns the number of elements in the LiveMap.
   */
  get size() {
    return this.#map.size;
  }

  /**
   * Returns a boolean indicating whether an element with the specified key exists or not.
   * @param key The key of the element to test for presence.
   */
  has(key: TKey): boolean {
    return this.#map.has(key);
  }

  /**
   * Removes the specified element by key.
   * @param key The key of the element to remove.
   * @returns true if an element existed and has been removed, or false if the element does not exist.
   */
  delete(key: TKey): boolean {
    const item = this.#map.get(key);

    if (item == null) {
      return false;
    }

    item._detach();

    if (this._doc && item._id) {
      this._doc.dispatch(
        [{ type: OpType.DeleteCrdt, id: item._id }],
        item._serialize(this._id!, key),
        [this]
      );
    }

    this.#map.delete(key);
    return true;
  }

  /**
   * Returns a new Iterator object that contains the [key, value] pairs for each element.
   */
  entries(): IterableIterator<[string, TValue]> {
    const innerIterator = this.#map.entries();

    return {
      [Symbol.iterator]: function () {
        return this;
      },
      next() {
        const iteratorValue = innerIterator.next();

        if (iteratorValue.done) {
          return {
            done: true,
            value: undefined,
          };
        }

        const entry = iteratorValue.value;

        return {
          value: [entry[0], selfOrRegisterValue(iteratorValue.value[1])],
        };
      },
    };
  }

  /**
   * Same function object as the initial value of the entries method.
   */
  [Symbol.iterator](): IterableIterator<[string, TValue]> {
    return this.entries();
  }

  /**
   * Returns a new Iterator object that contains the keys for each element.
   */
  keys(): IterableIterator<TKey> {
    return this.#map.keys();
  }

  /**
   * Returns a new Iterator object that contains the values for each element.
   */
  values(): IterableIterator<TValue> {
    const innerIterator = this.#map.values();

    return {
      [Symbol.iterator]: function () {
        return this;
      },
      next() {
        const iteratorValue = innerIterator.next();

        if (iteratorValue.done) {
          return {
            done: true,
            value: undefined,
          };
        }

        return {
          value: selfOrRegisterValue(iteratorValue.value),
        };
      },
    };
  }

  /**
   * Executes a provided function once per each key/value pair in the Map object, in insertion order.
   * @param callback Function to execute for each entry in the map.
   */
  forEach(
    callback: (value: TValue, key: TKey, map: LiveMap<TKey, TValue>) => void
  ) {
    for (const entry of this) {
      callback(entry[1], entry[0] as TKey, this);
    }
  }
}
