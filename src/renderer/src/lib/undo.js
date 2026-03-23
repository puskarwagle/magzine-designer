/**
 * Generic Undo/Redo Stack
 */
export class UndoStack {
  constructor(maxSize = 50) {
    this.stack = [];
    this.redoStack = [];
    this.maxSize = maxSize;
  }

  push(state) {
    this.stack.push(JSON.parse(JSON.stringify(state)));
    if (this.stack.length > this.maxSize) {
      this.stack.shift();
    }
    this.redoStack = [];
  }

  undo(currentState) {
    if (this.stack.length === 0) {
      return null;
    }
    this.redoStack.push(JSON.parse(JSON.stringify(currentState)));
    return this.stack.pop();
  }

  redo(currentState) {
    if (this.redoStack.length === 0) {
      return null;
    }
    this.stack.push(JSON.parse(JSON.stringify(currentState)));
    return this.redoStack.pop();
  }

  canUndo() {
    return this.stack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  clear() {
    this.stack = [];
    this.redoStack = [];
  }
}
