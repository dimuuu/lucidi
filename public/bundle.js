
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.ui = factory());
})(this, (function () { 'use strict';

    function noop() { }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    new Set();
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        text.data = data;
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function set_style(node, key, value, important) {
        if (value === null) {
            node.style.removeProperty(key);
        }
        else {
            node.style.setProperty(key, value, important ? 'important' : '');
        }
    }

    // we need to store the information for multiple documents because a Svelte application could also contain iframes
    // https://github.com/sveltejs/svelte/issues/3624
    new Map();

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    let render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = /* @__PURE__ */ Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        // Do not reenter flush while dirty components are updated, as this can
        // result in an infinite loop. Instead, let the inner flush handle it.
        // Reentrancy is ok afterwards for bindings etc.
        if (flushidx !== 0) {
            return;
        }
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            try {
                while (flushidx < dirty_components.length) {
                    const component = dirty_components[flushidx];
                    flushidx++;
                    set_current_component(component);
                    update(component.$$);
                }
            }
            catch (e) {
                // reset dirty state to not end up in a deadlocked state and then rethrow
                dirty_components.length = 0;
                flushidx = 0;
                throw e;
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    /**
     * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
     */
    function flush_render_callbacks(fns) {
        const filtered = [];
        const targets = [];
        render_callbacks.forEach((c) => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
        targets.forEach((c) => c());
        render_callbacks = filtered;
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }

    const _boolean_attributes = [
        'allowfullscreen',
        'allowpaymentrequest',
        'async',
        'autofocus',
        'autoplay',
        'checked',
        'controls',
        'default',
        'defer',
        'disabled',
        'formnovalidate',
        'hidden',
        'inert',
        'ismap',
        'loop',
        'multiple',
        'muted',
        'nomodule',
        'novalidate',
        'open',
        'playsinline',
        'readonly',
        'required',
        'reversed',
        'selected'
    ];
    /**
     * List of HTML boolean attributes (e.g. `<input disabled>`).
     * Source: https://html.spec.whatwg.org/multipage/indices.html
     */
    new Set([..._boolean_attributes]);
    function mount_component(component, target, anchor, customElement) {
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            flush_render_callbacks($$.after_update);
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: [],
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            if (!is_function(callback)) {
                return noop;
            }
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function styleInject(css, ref) {
      if ( ref === void 0 ) ref = {};
      var insertAt = ref.insertAt;

      if (!css || typeof document === 'undefined') { return; }

      var head = document.head || document.getElementsByTagName('head')[0];
      var style = document.createElement('style');
      style.type = 'text/css';

      if (insertAt === 'top') {
        if (head.firstChild) {
          head.insertBefore(style, head.firstChild);
        } else {
          head.appendChild(style);
        }
      } else {
        head.appendChild(style);
      }

      if (style.styleSheet) {
        style.styleSheet.cssText = css;
      } else {
        style.appendChild(document.createTextNode(css));
      }
    }

    var css_248z$1 = "/* Vars */\n:root {\n  /* COLORS */\n  /* Accent */\n  --blue: #18a0fb;\n  --purple: #7b61ff;\n  --hot-pink: #ff00ff;\n  --green: #1bc47d;\n  --red: #f24822;\n  --yellow: #ffeb00;\n  /* Basic foreground */\n  --black: #000000;\n  --black8: rgba(0, 0, 0, .8);\n  --black8-opaque: #333333;\n  --black3: rgba(0, 0, 0, .3);\n  --black3-opaque: #B3B3B3;\n  --white: #ffffff;\n  --white8: rgba(255, 255, 255, .8);\n  --white4: rgba(255, 255, 255, .4);\n  /* Basic background */\n  --grey: #f0f0f0;\n  --silver: #e5e5e5;\n  --hud: #222222;\n  --toolbar: #2c2c2c;\n  /* Special */\n  --black1: rgba(0, 0, 0, .1);\n  --blue3: rgba(24, 145, 251, .3);\n  --purple4: rgba(123, 97, 255, .4);\n  --hover-fill: rgba(0, 0, 0, .06);\n  --selection-a: #daebf7;\n  --selection-b: #edf5fa;\n  --white2: rgba(255, 255, 255, .2);\n  /* TYPOGRAPHY */\n  /* Pos = positive applications (black on white) */\n  /* Neg = negative applications (white on black) */\n  /* Font stack */\n  --font-stack: 'Inter', sans-serif;\n  /* Font sizes */\n  --font-size-xsmall: 11px;\n  --font-size-small: 12px;\n  --font-size-large: 13px;\n  --font-size-xlarge: 14px;\n  /* Font weights */\n  --font-weight-normal: 400;\n  --font-weight-medium: 500;\n  --font-weight-bold: 600;\n  /* Lineheight */\n  --font-line-height: 16px;\n  /* Use For xsmall, small font sizes */\n  --font-line-height-large: 24px;\n  /* Use For large, xlarge font sizes */\n  /* Letterspacing */\n  --font-letter-spacing-pos-xsmall: .005em;\n  --font-letter-spacing-neg-xsmall: .01em;\n  --font-letter-spacing-pos-small: 0;\n  --font-letter-spacing-neg-small: .005em;\n  --font-letter-spacing-pos-large: -.0025em;\n  --font-letter-spacing-neg-large: .0025em;\n  --font-letter-spacing-pos-xlarge: -.001em;\n  --font-letter-spacing-neg-xlarge: -.001em;\n  /* BORDER RADIUS */\n  --border-radius-small: 2px;\n  --border-radius-med: 5px;\n  --border-radius-large: 6px;\n  /* SHADOWS */\n  --shadow-hud: 0 5px 17px rgba(0, 0, 0, .2), 0 2px 7px rgba(0, 0, 0, .15);\n  --shadow-floating-window: 0 2px 14px rgba(0, 0, 0, .15);\n  /* SPACING + SIZING */\n  --size-xxxsmall: 4px;\n  --size-xxsmall: 8px;\n  --size-xsmall: 16px;\n  --size-small: 24px;\n  --size-medium: 32px;\n  --size-large: 40px;\n  --size-xlarge: 48px;\n  --size-xxlarge: 64px;\n  --size-xxxlarge: 80px;\n}\n\n/* Global styles */\n* {\n  box-sizing: border-box;\n}\n\nbody {\n  position: relative;\n  box-sizing: border-box;\n  font-family: 'Inter', sans-serif;\n  margin: 0;\n  padding: 0;\n}\n\n/*  FONTS */\n@font-face {\n  font-family: 'Inter';\n  font-weight: 400;\n  font-style: normal;\n  src: url(\"https://rsms.me/inter/font-files/Inter-Regular.woff2?v=3.7\") format(\"woff2\"), url(\"https://rsms.me/inter/font-files/Inter-Regular.woff?v=3.7\") format(\"woff\");\n}\n\n@font-face {\n  font-family: 'Inter';\n  font-weight: 500;\n  font-style: normal;\n  src: url(\"https://rsms.me/inter/font-files/Inter-Medium.woff2?v=3.7\") format(\"woff2\"), url(\"https://rsms.me/inter/font-files/Inter-Medium.woff2?v=3.7\") format(\"woff\");\n}\n\n@font-face {\n  font-family: 'Inter';\n  font-weight: 600;\n  font-style: normal;\n  src: url(\"https://rsms.me/inter/font-files/Inter-SemiBold.woff2?v=3.7\") format(\"woff2\"), url(\"https://rsms.me/inter/font-files/Inter-SemiBold.woff2?v=3.7\") format(\"woff\");\n}\n\n/* UTILITIES */\n/* padding */\n.p-xxxsmall {\n  padding: var(--size-xxxsmall);\n}\n\n.p-xxsmall {\n  padding: var(--size-xxsmall);\n}\n\n.p-xsmall {\n  padding: var(--size-xsmall);\n}\n\n.p-small {\n  padding: var(--size-small);\n}\n\n.p-medium {\n  padding: var(--size-medium);\n}\n\n.p-large {\n  padding: var(--size-large);\n}\n\n.p-xlarge {\n  padding: var(--size-xlarge);\n}\n\n.p-xxlarge {\n  padding: var(--size-xxlarge);\n}\n\n.p-huge {\n  padding: var(--size-xxxlarge);\n}\n\n/* padding top */\n.pt-xxxsmall {\n  padding-top: var(--size-xxxsmall);\n}\n\n.pt-xxsmall {\n  padding-top: var(--size-xxsmall);\n}\n\n.pt-xsmall {\n  padding-top: var(--size-xsmall);\n}\n\n.pt-small {\n  padding-top: var(--size-small);\n}\n\n.pt-medium {\n  padding-top: var(--size-medium);\n}\n\n.pt-large {\n  padding-top: var(--size-large);\n}\n\n.pt-xlarge {\n  padding-top: var(--size-xlarge);\n}\n\n.pt-xxlarge {\n  padding-top: var(--size-xxlarge);\n}\n\n.pt-huge {\n  padding-top: var(--size-xxxlarge);\n}\n\n/* padding right */\n.pr-xxxsmall {\n  padding-right: var(--size-xxxsmall);\n}\n\n.pr-xxsmall {\n  padding-right: var(--size-xxsmall);\n}\n\n.pr-xsmall {\n  padding-right: var(--size-xsmall);\n}\n\n.pr-small {\n  padding-right: var(--size-small);\n}\n\n.pr-medium {\n  padding-right: var(--size-medium);\n}\n\n.pr-large {\n  padding-right: var(--size-large);\n}\n\n.pr-xlarge {\n  padding-right: var(--size-xlarge);\n}\n\n.pr-xxlarge {\n  padding-right: var(--size-xxlarge);\n}\n\n.pr-huge {\n  padding-right: var(--size-xxxlarge);\n}\n\n/* padding bottom */\n.pb-xxxsmall {\n  padding-bottom: var(--size-xxxsmall);\n}\n\n.pb-xxsmall {\n  padding-bottom: var(--size-xxsmall);\n}\n\n.pb-xsmall {\n  padding-bottom: var(--size-xsmall);\n}\n\n.pb-small {\n  padding-bottom: var(--size-small);\n}\n\n.pb-medium {\n  padding-bottom: var(--size-medium);\n}\n\n.pb-large {\n  padding-bottom: var(--size-large);\n}\n\n.pb-xlarge {\n  padding-bottom: var(--size-xlarge);\n}\n\n.pb-xxlarge {\n  padding-bottom: var(--size-xxlarge);\n}\n\n.pb-huge {\n  padding-bottom: var(--size-xxxlarge);\n}\n\n/* padding left */\n.pl-xxxsmall {\n  padding-left: var(--size-xxxsmall);\n}\n\n.pl-xxsmall {\n  padding-left: var(--size-xxsmall);\n}\n\n.pl-xsmall {\n  padding-left: var(--size-xsmall);\n}\n\n.pl-small {\n  padding-left: var(--size-small);\n}\n\n.pl-medium {\n  padding-left: var(--size-medium);\n}\n\n.pl-large {\n  padding-left: var(--size-large);\n}\n\n.pl-xlarge {\n  padding-left: var(--size-xlarge);\n}\n\n.pl-xxlarge {\n  padding-left: var(--size-xxlarge);\n}\n\n.pl-huge {\n  padding-left: var(--size-xxxlarge);\n}\n\n/* margin */\n.m-xxxsmall {\n  margin: var(--size-xxxsmall);\n}\n\n.m-xxsmall {\n  margin: var(--size-xxsmall);\n}\n\n.m-xsmall {\n  margin: var(--size-xsmall);\n}\n\n.m-small {\n  margin: var(--size-small);\n}\n\n.m-medium {\n  margin: var(--size-medium);\n}\n\n.m-large {\n  margin: var(--size-large);\n}\n\n.m-xlarge {\n  margin: var(--size-xlarge);\n}\n\n.m-xxlarge {\n  margin: var(--size-xxlarge);\n}\n\n.m-huge {\n  margin: var(--size-xxxlarge);\n}\n\n/* margin top */\n.mt-xxxsmall {\n  margin-top: var(--size-xxxsmall);\n}\n\n.mt-xxsmall {\n  margin-top: var(--size-xxsmall);\n}\n\n.mt-xsmall {\n  margin-top: var(--size-xsmall);\n}\n\n.mt-small {\n  margin-top: var(--size-small);\n}\n\n.mt-medium {\n  margin-top: var(--size-medium);\n}\n\n.mt-large {\n  margin-top: var(--size-large);\n}\n\n.mt-xlarge {\n  margin-top: var(--size-xlarge);\n}\n\n.mt-xxlarge {\n  margin-top: var(--size-xxlarge);\n}\n\n.mt-huge {\n  margin-top: var(--size-xxxlarge);\n}\n\n/* margin right */\n.mr-xxxsmall {\n  margin-right: var(--size-xxxsmall);\n}\n\n.mr-xxsmall {\n  margin-right: var(--size-xxsmall);\n}\n\n.mr-xsmall {\n  margin-right: var(--size-xsmall);\n}\n\n.mr-small {\n  margin-right: var(--size-small);\n}\n\n.mr-medium {\n  margin-right: var(--size-medium);\n}\n\n.mr-large {\n  margin-right: var(--size-large);\n}\n\n.mr-xlarge {\n  margin-right: var(--size-xlarge);\n}\n\n.mr-xxlarge {\n  margin-right: var(--size-xxlarge);\n}\n\n.mr-huge {\n  margin-right: var(--size-xxxlarge);\n}\n\n/* margin bottom */\n.mb-xxxsmall {\n  margin-bottom: var(--size-xxxsmall);\n}\n\n.mb-xxsmall {\n  margin-bottom: var(--size-xxsmall);\n}\n\n.mb-xsmall {\n  margin-bottom: var(--size-xsmall);\n}\n\n.mb-small {\n  margin-bottom: var(--size-small);\n}\n\n.mb-medium {\n  margin-bottom: var(--size-medium);\n}\n\n.mb-large {\n  margin-bottom: var(--size-large);\n}\n\n.mb-xlarge {\n  margin-bottom: var(--size-xlarge);\n}\n\n.mb-xxlarge {\n  margin-bottom: var(--size-xxlarge);\n}\n\n.mb-huge {\n  margin-bottom: var(--size-xxxlarge);\n}\n\n/* margin left */\n.ml-xxxsmall {\n  margin-left: var(--size-xxxsmall);\n}\n\n.ml-xxsmall {\n  margin-left: var(--size-xxsmall);\n}\n\n.ml-xsmall {\n  margin-left: var(--size-xsmall);\n}\n\n.ml-small {\n  margin-left: var(--size-small);\n}\n\n.ml-medium {\n  margin-left: var(--size-medium);\n}\n\n.ml-large {\n  margin-left: var(--size-large);\n}\n\n.ml-xlarge {\n  margin-left: var(--size-xlarge);\n}\n\n.ml-xxlarge {\n  margin-left: var(--size-xxlarge);\n}\n\n.ml-huge {\n  margin-left: var(--size-xxxlarge);\n}\n\n/* layout utilities */\n.hidden {\n  display: none;\n}\n\n.inline {\n  display: inline;\n}\n\n.block {\n  display: block;\n}\n\n.inline-block {\n  display: inline-block;\n}\n\n.flex {\n  display: flex;\n}\n\n.inline-flex {\n  display: inline-flex;\n}\n\n.column {\n  flex-direction: column;\n}\n\n.column-reverse {\n  flex-direction: column-reverse;\n}\n\n.row {\n  flex-direction: row;\n}\n\n.row-reverse {\n  flex-direction: row-reverse;\n}\n\n.flex-wrap {\n  flex-wrap: wrap;\n}\n\n.flex-wrap-reverse {\n  flex-wrap: wrap-reverse;\n}\n\n.flex-no-wrap {\n  flex-wrap: nowrap;\n}\n\n.flex-shrink {\n  flex-shrink: 1;\n}\n\n.flex-no-shrink {\n  flex-shrink: 0;\n}\n\n.flex-grow {\n  flex-grow: 1;\n}\n\n.flex-no-grow {\n  flex-grow: 0;\n}\n\n.justify-content-start {\n  justify-content: flex-start;\n}\n\n.justify-content-end {\n  justify-content: flex-end;\n}\n\n.justify-content-center {\n  justify-content: center;\n}\n\n.justify-content-between {\n  justify-content: space-between;\n}\n\n.justify-content-around {\n  justify-content: space-around;\n}\n\n.align-items-start {\n  align-items: flex-start;\n}\n\n.align-items-end {\n  align-items: flex-end;\n}\n\n.align-items-center {\n  align-items: center;\n}\n\n.align-items-stretch {\n  align-items: stretch;\n}\n\n.align-content-start {\n  align-content: flex-start;\n}\n\n.align-content-end {\n  align-content: flex-end;\n}\n\n.align-content-center {\n  align-content: center;\n}\n\n.align-content-stretch {\n  align-content: stretch;\n}\n\n.align-self-start {\n  align-self: flex-start;\n}\n\n.align-self-end {\n  align-items: flex-end;\n}\n\n.align-self-center {\n  align-self: center;\n}\n\n.align-self-stretch {\n  align-self: stretch;\n}\n\n.button {\n  display: flex;\n  align-items: center;\n  border-radius: var(--border-radius-large);\n  color: var(--white);\n  flex-shrink: 0;\n  font-family: var(--font-stack);\n  font-size: var(--font-size-xsmall);\n  font-weight: var(--font-weight-medium);\n  letter-spacing: var(--font-letter-spacing-neg-small);\n  line-height: var(--font-line-height);\n  height: var(--size-medium);\n  padding: 0 var(--size-xsmall) 0 var(--size-xsmall);\n  text-decoration: none;\n  outline: none;\n  border: 2px solid transparent;\n  -webkit-user-select: none;\n     -moz-user-select: none;\n      -ms-user-select: none;\n          user-select: none;\n}\n\n.button--primary {\n  background-color: var(--blue);\n}\n\n.button--primary:enabled:active, .button--primary:enabled:focus {\n  border: 2px solid var(--black3);\n}\n\n.button--primary:disabled {\n  background-color: var(--black3);\n}\n\n.button--primary-destructive {\n  background-color: var(--red);\n}\n\n.button--primary-destructive:enabled:active, .button--primary-destructive:enabled:focus {\n  border: 2px solid var(--black3);\n}\n\n.button--primary-destructive:disabled {\n  opacity: 0.3;\n}\n\n.button--secondary, .button--secondary-destructive {\n  background-color: var(--white);\n  border: 1px solid var(--black8);\n  color: var(--black8);\n  padding: 0 calc(var(--size-xsmall) + 1px) 0 calc(var(--size-xsmall) + 1px);\n  letter-spacing: var(--font-letter-spacing-pos-small);\n}\n\n.button--secondary:enabled:active, .button--secondary-destructive:enabled:active, .button--secondary:enabled:focus, .button--secondary-destructive:enabled:focus {\n  border: 2px solid var(--blue);\n  padding: 0 var(--size-xsmall) 0 var(--size-xsmall);\n}\n\n.button--secondary:disabled, .button--secondary-destructive:disabled {\n  border: 1px solid var(--black3);\n  color: var(--black3);\n}\n\n.button--secondary-destructive {\n  border-color: var(--red);\n  color: var(--red);\n}\n\n.button--secondary-destructive:disabled {\n  background-color: var(--white);\n}\n\n.button--secondary-destructive:enabled:active, .button--secondary-destructive:enabled:focus {\n  border: 2px solid var(--red);\n  padding: 0 var(--size-xsmall) 0 var(--size-xsmall);\n}\n\n.button--secondary-destructive:disabled {\n  border: 1px solid var(--red);\n  background-color: var(--white);\n  color: var(--red);\n  opacity: 0.4;\n}\n\n.button--tertiary, .button--tertiary-destructive {\n  border: 1px solid transparent;\n  color: var(--blue);\n  background-color: transparent;\n  padding: 0;\n  font-weight: var(--font-weight-normal);\n  letter-spacing: var(--font-letter-spacing-pos-small);\n  cursor: pointer;\n}\n\n.button--tertiary:enabled:focus, .button--tertiary-destructive:enabled:focus {\n  text-decoration: underline;\n}\n\n.button--tertiary:disabled, .button--tertiary-destructive:disabled {\n  cursor: default;\n  color: var(--black3);\n}\n\n.button--tertiary-destructive {\n  color: var(--red);\n}\n\n.button--tertiary-destructive:enabled:focus {\n  text-decoration: underline;\n}\n\n.button--tertiary-destructive:disabled {\n  opacity: 0.4;\n}\n\n.checkbox {\n  align-items: center;\n  cursor: default;\n  display: flex;\n  height: var(--size-medium);\n  position: relative;\n  /* unchecked */\n  /*\n\t&__box:focus + &__label:before {\n\t\tborder: 1px solid var(--white);\n\t    box-shadow: 0 0 0 2px var(--blue);\n\t}*/\n  /* checked */\n  /*\n\t&__box:checked:focus + &__label:before {\n\t\tborder: 1px solid var(--white);\n\t    box-shadow: 0 0 0 2px var(--blue);\n\t}*/\n}\n\n.checkbox__box {\n  opacity: 0;\n  width: 10px;\n  height: 10px;\n  margin: 0;\n  padding: 0;\n}\n\n.checkbox__label {\n  align-items: center;\n  color: var(--black8);\n  display: flex;\n  font-family: var(--font-stack);\n  font-size: var(--font-size-xsmall);\n  font-weight: var(--font-weight-normal);\n  line-height: var(--font-line-height);\n  letter-spacing: var(--font-letter-spacing-pos-xsmall);\n  margin-left: -16px;\n  padding: 0 var(--size-xsmall) 0 var(--size-small);\n  height: 100%;\n  -webkit-user-select: none;\n     -moz-user-select: none;\n      -ms-user-select: none;\n          user-select: none;\n}\n\n.checkbox__label:before {\n  border: 1px solid var(--black8);\n  border-radius: var(--border-radius-small);\n  content: '';\n  display: block;\n  width: 10px;\n  height: 10px;\n  margin: -1px 10px 0 -8px;\n  box-shadow: none;\n}\n\n.checkbox__box:disabled + .checkbox__label {\n  color: var(--black);\n  opacity: 0.3;\n}\n\n.checkbox__box:checked + .checkbox__label:before {\n  background-color: var(--blue);\n  background-image: url(\"data:image/svg+xml;utf8,%3Csvg%20fill%3D%22none%22%20height%3D%227%22%20viewBox%3D%220%200%208%207%22%20width%3D%228%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20clip-rule%3D%22evenodd%22%20d%3D%22m1.17647%201.88236%201.88235%201.88236%203.76471-3.76472%201.17647%201.17648-4.94118%204.9412-3.05882-3.05884z%22%20fill%3D%22%23fff%22%20fill-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E\");\n  background-repeat: no-repeat;\n  background-position: 1px 2px;\n  border: 1px solid var(--blue);\n}\n\n.checkbox__box:checked:disabled + .checkbox__label:before {\n  border: 1px solid transparent;\n  background-color: var(--black8);\n}\n\n.disclosure {\n  position: relative;\n  width: 100%;\n  margin: 0;\n  padding: 0;\n  list-style-type: none;\n}\n\n.disclosure__item {\n  display: flex;\n  flex-direction: column;\n  position: relative;\n  width: 100%;\n  margin: 0;\n  padding: 0;\n  list-style-type: none;\n  border-bottom: 1px solid var(--silver);\n}\n\n.disclosure__item:last-child {\n  border-bottom: 1px solid transparent;\n}\n\n.disclosure__label {\n  display: flex;\n  align-items: center;\n  height: var(--size-medium);\n  font-size: var(--font-size-xsmall);\n  font-weight: var(--font-weight-normal);\n  letter-spacing: var(--font-letter-spacing-pos-xsmall);\n  line-height: var(--line-height);\n  color: var(--black8);\n  padding: 0 8px 0 24px;\n  cursor: default;\n  -webkit-user-select: none;\n     -moz-user-select: none;\n      -ms-user-select: none;\n          user-select: none;\n}\n\n.disclosure__label:before {\n  content: '';\n  position: absolute;\n  top: 8px;\n  left: 4px;\n  display: block;\n  width: 16px;\n  height: 16px;\n  opacity: 0.3;\n  background-image: url(\"data:image/svg+xml;utf8,%3Csvg%20fill%3D%22none%22%20height%3D%2216%22%20viewBox%3D%220%200%2016%2016%22%20width%3D%2216%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22m11%208-4-3v6z%22%20fill%3D%22%23000%22%2F%3E%3C%2Fsvg%3E\");\n  background-repeat: no-repeat;\n  background-position: center center;\n}\n\n.disclosure__label:hover:before {\n  opacity: 0.8;\n}\n\n.disclosure__content {\n  font-size: var(--font-size-xsmall);\n  font-weight: var(--font-weight-normal);\n  letter-spacing: var(--font-letter-spacing-pos-xsmall);\n  line-height: var(--line-height);\n  color: var(--black8);\n  padding: var(--size-xxsmall) var(--size-xxsmall) var(--size-xxsmall) var(--size-small);\n  display: none;\n  -webkit-user-select: none;\n     -moz-user-select: none;\n      -ms-user-select: none;\n          user-select: none;\n  pointer-events: none;\n}\n\n.disclosure--section {\n  font-weight: var(--font-weight-bold);\n}\n\n.disclosure--expanded .disclosure__content {\n  display: block;\n  border-bottom: 1px solid transparent;\n}\n\n.disclosure--expanded .disclosure__label:before {\n  opacity: 0.8;\n  background-image: url(\"data:image/svg+xml;utf8,%3Csvg%20fill%3D%22none%22%20height%3D%2216%22%20viewBox%3D%220%200%2016%2016%22%20width%3D%2216%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22m9%2010%203-4h-6z%22%20fill%3D%22%23000%22%2F%3E%3C%2Fsvg%3E\");\n}\n\n.icon {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  cursor: default;\n  width: var(--size-medium);\n  height: var(--size-medium);\n  font-family: var(--font-stack);\n  font-size: var(--font-size-xsmall);\n  -webkit-user-select: none;\n     -moz-user-select: none;\n      -ms-user-select: none;\n          user-select: none;\n  background-position: 50% 50%;\n}\n\n.icon--spin {\n  -webkit-animation: rotating 1.0s linear infinite;\n          animation: rotating 1.0s linear infinite;\n}\n\n@-webkit-keyframes rotating {\n  from {\n    transform: rotate(0deg);\n  }\n  to {\n    transform: rotate(360deg);\n  }\n}\n\n@keyframes rotating {\n  from {\n    transform: rotate(0deg);\n  }\n  to {\n    transform: rotate(360deg);\n  }\n}\n\n.icon--blue {\n  filter: invert(54%) sepia(16%) saturate(7499%) hue-rotate(179deg) brightness(98%) contrast(101%);\n}\n\n.icon--purple {\n  filter: invert(40%) sepia(59%) saturate(4001%) hue-rotate(232deg) brightness(103%) contrast(102%);\n}\n\n.icon--purple4 {\n  filter: invert(72%) sepia(40%) saturate(660%) hue-rotate(202deg) brightness(103%) contrast(103%);\n}\n\n.icon--hot-pink {\n  filter: invert(18%) sepia(90%) saturate(3347%) hue-rotate(293deg) brightness(116%) contrast(132%);\n}\n\n.icon--green {\n  filter: invert(66%) sepia(39%) saturate(5382%) hue-rotate(114deg) brightness(102%) contrast(79%);\n}\n\n.icon--red {\n  filter: invert(43%) sepia(56%) saturate(5632%) hue-rotate(349deg) brightness(97%) contrast(95%);\n}\n\n.icon--yellow {\n  filter: invert(78%) sepia(86%) saturate(1608%) hue-rotate(1deg) brightness(107%) contrast(104%);\n}\n\n.icon--black {\n  filter: invert(0%) sepia(0%) saturate(7500%) hue-rotate(117deg) brightness(109%) contrast(105%);\n}\n\n.icon--black8 {\n  filter: invert(0%) sepia(56%) saturate(25%) hue-rotate(137deg) brightness(105%) contrast(60%);\n}\n\n.icon--black3 {\n  filter: invert(100%) sepia(0%) saturate(698%) hue-rotate(219deg) brightness(66%) contrast(127%);\n}\n\n.icon--white {\n  filter: invert(100%) sepia(100%) saturate(0%) hue-rotate(269deg) brightness(103%) contrast(104%);\n}\n\n.icon--white8 {\n  filter: invert(99%) sepia(2%) saturate(5%) hue-rotate(55deg) brightness(104%) contrast(98%);\n}\n\n.icon--white4 {\n  filter: invert(99%) sepia(2%) saturate(897%) hue-rotate(245deg) brightness(117%) contrast(93%);\n}\n\n.icon--adjust {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cg clip-rule='evenodd' fill='%23000' fill-rule='evenodd'%3E%3Cpath d='M12 16.05V9h1v7.05a2.5 2.5 0 010 4.9V23h-1v-2.05a2.5 2.5 0 010-4.9zm2 2.45a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM19 23h1v-7.05a2.5 2.5 0 000-4.9V9h-1v2.05a2.5 2.5 0 000 4.9zm2-9.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z'/%3E%3C/g%3E%3C/svg%3E\");\n}\n\n.icon--alert {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000'%3E%3Cpath clip-rule='evenodd' d='M21.25 17.393a1.75 1.75 0 001.75 1.75V20H9v-.857a1.75 1.75 0 001.75-1.75V14c0-3.314 2.35-6 5.25-6s5.25 2.686 5.25 6zm-1-3.393v3.393c0 .6.192 1.155.518 1.607h-9.536a2.738 2.738 0 00.518-1.607V14c0-2.891 2.024-5 4.25-5s4.25 2.109 4.25 5z' fill-rule='evenodd'/%3E%3Cpath d='M16 23a2 2 0 01-2-2h-1a3 3 0 106 0h-1a2 2 0 01-2 2z'/%3E%3C/g%3E%3C/svg%3E\");\n}\n\n.icon--angle {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath clip-rule='evenodd' d='M12 12v8h8v-1h-3a4 4 0 00-4-4v-3zm1 4v3h3a3 3 0 00-3-3z' fill='%23000' fill-rule='evenodd'/%3E%3C/svg%3E\");\n}\n\n.icon--arrow-left-right {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12.207 16.5l1.647 1.646-.707.708L10.293 16l2.854-2.854.707.708-1.647 1.646h7.586l-1.646-1.646.707-.708L21.707 16l-2.853 2.854-.707-.708 1.646-1.646z' fill='%23000'/%3E%3C/svg%3E\");\n}\n\n.icon--up-down {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M16 10.292l2.854 2.854-.707.707-1.646-1.646v7.585l1.646-1.646.707.707-2.853 2.854-2.854-2.854.707-.707 1.647 1.646v-7.585l-1.647 1.646-.707-.707z' fill='%23000'/%3E%3C/svg%3E\");\n}\n\n.icon--auto-layout-horizontal {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath clip-rule='evenodd' d='M10 10h5v12h-5zm1 1h3v10h-3zm6-1h5v12h-5zm1 1h3v10h-3z' fill='%23000' fill-rule='evenodd'/%3E%3C/svg%3E\");\n}\n\n.icon--auto-layout-vertical {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath clip-rule='evenodd' d='M10 10h12v5H10zm1 1h10v3H11zm-1 6h12v5H10zm1 1h10v3H11z' fill='%23000' fill-rule='evenodd'/%3E%3C/svg%3E\");\n}\n\n.icon--back {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath clip-rule='evenodd' d='M13.707 16l4.646-4.646-.707-.707L12.293 16l5.353 5.354.707-.707z' fill='%23000' fill-rule='evenodd'/%3E%3C/svg%3E\");\n}\n\n.icon--blend-empty {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath clip-rule='evenodd' d='M16.695 11.72l-.693-.718L16 11l-.001.002-.694.718C13.102 14.012 12 15.294 12 16.852a4.199 4.199 0 001.172 2.936 3.906 3.906 0 005.656 0A4.199 4.199 0 0020 16.852c0-1.558-1.102-2.84-3.305-5.132zm-.695.72c-.977 1.017-1.693 1.79-2.195 2.471-.6.814-.805 1.38-.805 1.94v.003a3.2 3.2 0 00.89 2.239 2.906 2.906 0 004.22 0 3.2 3.2 0 00.89-2.239v-.002c0-.56-.205-1.127-.805-1.94-.502-.681-1.219-1.455-2.195-2.472z' fill='%23000' fill-rule='evenodd'/%3E%3C/svg%3E\");\n}\n\n.icon--blend {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath clip-rule='evenodd' d='M16.002 11.002l.693.718C18.898 14.012 20 15.294 20 16.852a4.199 4.199 0 01-1.172 2.936 3.906 3.906 0 01-5.656 0A4.199 4.199 0 0112 16.852c0-1.558 1.102-2.84 3.305-5.132l.694-.719zm-2.197 3.91c.502-.681 1.219-1.455 2.195-2.472.976 1.017 1.693 1.79 2.195 2.471.6.814.805 1.38.805 1.94v.003c0 .049 0 .098-.003.146h-5.994a3.37 3.37 0 01-.003-.146v-.002c0-.56.205-1.127.805-1.94z' fill='%23000' fill-rule='evenodd'/%3E%3C/svg%3E\");\n}\n\n.icon--break {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000' opacity='.9'%3E%3Cpath d='M13 9v3h1V9zM22.103 9.896a2.975 2.975 0 00-4.207 0l-2.75 2.75.707.707 2.75-2.75a1.975 1.975 0 012.793 2.793l-2.75 2.75.707.707 2.75-2.75a2.975 2.975 0 000-4.207zM9.896 22.104a2.975 2.975 0 010-4.208l2.75-2.75.707.707-2.75 2.75a1.975 1.975 0 002.793 2.793l2.75-2.75.707.707-2.75 2.75a2.975 2.975 0 01-4.207 0zM23 19h-3v-1h3zM19 20v3h-1v-3zM12 13H9v1h3z'/%3E%3C/g%3E%3C/svg%3E\");\n}\n\n.icon--caret-down {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M16 18l3-4h-6z' fill='%23000'/%3E%3C/svg%3E\");\n}\n\n.icon--caret-left {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M13 16l4-3v6z' fill='%23000'/%3E%3C/svg%3E\");\n}\n\n.icon--caret-right {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M19 16l-4-3v6z' fill='%23000'/%3E%3C/svg%3E\");\n}\n\n.icon--caret-up {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M16 14l3 4h-6z' fill='%23000'/%3E%3C/svg%3E\");\n}\n\n.icon--check {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath clip-rule='evenodd' d='M21.207 13.707L15 19.914l-3.707-3.707 1.414-1.414L15 17.086l4.793-4.793z' fill='%23000' fill-rule='evenodd'/%3E%3C/svg%3E\");\n}\n\n.icon--close {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M16 15.293l4.646-4.646.708.707L16.707 16l4.647 4.647-.707.707L16 16.707l-4.646 4.647-.707-.707L15.293 16l-4.646-4.646.707-.707z' fill='%23000'/%3E%3C/svg%3E\");\n}\n\n.icon--component {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath clip-rule='evenodd' d='M12.063 10.938L16 14.874l3.938-3.938L16 7zm6.46 0L16 13.46l-2.523-2.524L16 8.415zm-6.46 10.124L16 25l3.938-3.938L16 17.125zm6.46 0L16 23.587l-2.523-2.523L16 18.538zM7 16l3.937-3.938L14.875 16l-3.938 3.938zm3.937 2.523L13.461 16l-2.524-2.523L8.415 16zM17.125 16l3.938 3.938L25 16l-3.938-3.938zm6.46 0l-2.523 2.523L18.54 16l2.523-2.523z' fill='%23000' fill-rule='evenodd'/%3E%3C/svg%3E\");\n}\n\n.icon--corner-radius {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath clip-rule='evenodd' d='M21 13h-4a4 4 0 00-4 4v4h-1v-4a5 5 0 015-5h4z' fill='%23000' fill-rule='evenodd'/%3E%3C/svg%3E\");\n}\n\n.icon--corners {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath clip-rule='evenodd' d='M11 11h3v1h-2v2h-1zm7 0h3v3h-1v-2h-2zm-6 9v-2h-1v3h3v-1zm9-2v3h-3v-1h2v-2z' fill='%23000' fill-rule='evenodd'/%3E%3C/svg%3E\");\n}\n\n.icon--distribute-horizontal-spacing {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000'%3E%3Cpath d='M11 22.5v-13h-1v13zM22 9.5v13h-1v-13zM17 12.5v7h-2v-7z'/%3E%3C/g%3E%3C/svg%3E\");\n}\n\n.icon--distribute-vertical-spacing {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000'%3E%3Cpath d='M9.5 10h13v1h-13zM12.5 15h7v2h-7zM22.5 21h-13v1h13z'/%3E%3C/g%3E%3C/svg%3E\");\n}\n\n.icon--draft {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath clip-rule='evenodd' d='M10 8.5h7.707L22 12.793V23.5H10zm1 1v13h10v-9h-4v-4zm7 .707l2.293 2.293H18z' fill='%23000' fill-rule='evenodd'/%3E%3C/svg%3E\");\n}\n\n.icon--effects {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000'%3E%3Cpath d='M16.5 8.5h-1v3h1zM11.05 10.343l-.707.707 2.121 2.122.708-.708zM21.657 11.05l-.707-.707-2.121 2.121.707.708zM8.5 15.5v1h3v-1zM20.5 15.5v1h3v-1zM13.172 19.535l-.708-.707-2.12 2.122.706.707zM19.535 18.828l-.707.707 2.122 2.122.707-.707zM16.5 20.5h-1v3h1z'/%3E%3Cpath clip-rule='evenodd' d='M18.498 15.998a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zm-1 0a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z' fill-rule='evenodd'/%3E%3C/g%3E%3C/svg%3E\");\n}\n\n.icon--ellipses {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath clip-rule='evenodd' d='M11.5 16a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm6 0a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm4.5 1.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z' fill='%23000' fill-rule='evenodd'/%3E%3C/svg%3E\");\n}\n\n.icon--eyedropper {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M22.447 9.6c-.8-.8-2-.8-2.8 0l-2.8 2.8-.8-.7c-.4-.4-1-.4-1.4 0s-.4 1 0 1.4l.7.7-5.8 5.8c-.4.4-1 1.9 0 2.9s2.5.4 2.9 0l5.8-5.8.7.7c.4.4 1 .4 1.4 0s.4-1 0-1.4l-.7-.7 2.8-2.8c.8-.9.8-2.1 0-2.9zm-10.9 11.9h-1v-1l5.8-5.8 1 1c-.1 0-5.8 5.8-5.8 5.8z' fill='%23000'/%3E%3C/svg%3E\");\n}\n\n.icon--forward {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath clip-rule='evenodd' d='M17.94 16l-4.647-4.646.707-.707L19.354 16 14 21.354l-.707-.707z' fill='%23000' fill-rule='evenodd'/%3E%3C/svg%3E\");\n}\n\n.icon--frame {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath clip-rule='evenodd' d='M11 24v-3H8v-1h3v-8H8v-1h3V8h1v3h8V8h1v3h3v1h-3v8h3v1h-3v3h-1v-3h-8v3zm9-4v-8h-8v8z' fill='%23000' fill-rule='evenodd'/%3E%3C/svg%3E\");\n}\n\n.icon--group {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000'%3E%3Cpath d='M17.4 9h-2.8v1h2.8zM20.9 22H22v-1.1h1V23h-2.1zM10 14.6v2.8H9v-2.8zM22 11.1V10h-1.1V9H23v2.1zM22 14.6v2.8h1v-2.8zM10 11.1V10h1.1V9H9v2.1zM9 20.9h1V22h1.1v1H9zM17.4 22h-2.8v1h2.8z'/%3E%3C/g%3E%3C/svg%3E\");\n}\n\n.icon--hidden {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath clip-rule='evenodd' d='M21.509 15.801A8.033 8.033 0 0022.928 14h-1.184A6.992 6.992 0 0116 17a6.992 6.992 0 01-5.745-3H9.07a8.033 8.033 0 001.421 1.801l-1.595 1.595.708.707 1.657-1.657c.71.523 1.511.932 2.374 1.199l-.617 2.221.964.268.626-2.255a8.051 8.051 0 002.784 0l.626 2.255.964-.268-.617-2.221a7.971 7.971 0 002.374-1.2l1.658 1.658.707-.707z' fill='%23000' fill-rule='evenodd'/%3E%3C/svg%3E\");\n}\n\n.icon--horizontal-padding {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000'%3E%3Cpath d='M9 9v14h1V9zm13 0v14h1V9z'/%3E%3Cpath clip-rule='evenodd' d='M13 19v-6h6v6zm-1-7h8v8h-8z' fill-rule='evenodd'/%3E%3C/g%3E%3C/svg%3E\");\n}\n\n.icon--hyperlink {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20.824 14.492l-1.657 1.657.828.829 1.658-1.657a3.517 3.517 0 00-4.973-4.973l-1.657 1.658.829.828 1.657-1.657a2.345 2.345 0 013.315 3.315zm-4.974 4.972l.829.829-1.658 1.657a3.516 3.516 0 11-4.972-4.972l1.659-1.658.828.829-1.656 1.657a2.343 2.343 0 103.315 3.315l1.657-1.657zm2.072-6.216l-4.972 4.973.828.829 4.973-4.973z' fill='%23000'/%3E%3C/svg%3E\");\n}\n\n.icon--image {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath clip-rule='evenodd' d='M22 10H10v7.793l3.083-3.083 7.29 7.29H22zM10 22v-2.793l3.083-3.083L18.96 22zm0-13a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1V10a1 1 0 00-1-1zm9.667 4.667a1.333 1.333 0 11-2.667 0 1.333 1.333 0 012.667 0zm1 0a2.333 2.333 0 11-4.667 0 2.333 2.333 0 014.667 0z' fill='%23000' fill-rule='evenodd'/%3E%3C/svg%3E\");\n}\n\n.icon--instance {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath clip-rule='evenodd' d='M16 7l9 9-9 9-9-9zm-7.586 9L16 23.586 23.586 16 16 8.414z' fill='%23000' fill-rule='evenodd'/%3E%3C/svg%3E\");\n}\n\n.icon--key {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath clip-rule='evenodd' d='M15.14 20.14a3.014 3.014 0 00.331-3.868l2.047-2.047 1.767 1.767a.5.5 0 10.707-.707l-1.767-1.767 1.293-1.293 1.784 1.784a.5.5 0 10.707-.707l-1.784-1.784.762-.761a.5.5 0 00-.707-.708l-5.513 5.513a3.014 3.014 0 10.373 4.578zm-.712-.712a2.006 2.006 0 10-2.837-2.837 2.006 2.006 0 002.837 2.837z' fill='%23000' fill-rule='evenodd'/%3E%3C/svg%3E\");\n}\n\n.icon--layout-align-bottom {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath clip-rule='evenodd' d='M14.5 10v10h-2V10zm8 12v1h-13v-1zm-3-2v-6h-2v6z' fill='%23000' fill-rule='evenodd'/%3E%3C/svg%3E\");\n}\n\n.icon--align-horizontal-centers {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M16.5 9.5h-1v3h-5v2h5v3h-3v2h3v3h1v-3h3v-2h-3v-3h5v-2h-5z' fill='%23000'/%3E%3C/svg%3E\");\n}\n\n.icon--align-left {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000'%3E%3Cpath d='M10 22.5H9v-13h1zM22 14.5H12v-2h10zM12 19.5h6v-2h-6z'/%3E%3C/g%3E%3C/svg%3E\");\n}\n\n.icon--align-right {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000'%3E%3Cpath d='M22 22.5h1v-13h-1zM10 14.5h10v-2H10zM20 19.5h-6v-2h6z'/%3E%3C/g%3E%3C/svg%3E\");\n}\n\n.icon--align-top {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000'%3E%3Cpath d='M14.5 22V12h-2v10zM22.5 10V9h-13v1zM19.5 12v6h-2v-6z'/%3E%3C/g%3E%3C/svg%3E\");\n}\n\n.icon--align-vertical-centers {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12.5 15.5v-5h2v5h3v-3h2v3h3v1h-3v3h-2v-3h-3v5h-2v-5h-3v-1z' fill='%23000'/%3E%3C/svg%3E\");\n}\n\n.icon--layout-grid-columns {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000'%3E%3Cpath d='M9 9h3v14H9zM14.5 9h3v14h-3zM20 9h3v14h-3z'/%3E%3C/g%3E%3C/svg%3E\");\n}\n\n.icon--layout-grid-rows {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000'%3E%3Cpath d='M9 9h14v3H9zM9 14.5h14v3H9zM9 20h14v3H9z'/%3E%3C/g%3E%3C/svg%3E\");\n}\n\n.icon--layout-grid-uniform {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000'%3E%3Cpath d='M9 9h3v3H9zM20 9h3v3h-3zM14.5 9h3v3h-3zM9 14.5h3v3H9zM20 14.5h3v3h-3zM14.5 14.5h3v3h-3zM9 20h3v3H9zM20 20h3v3h-3zM14.5 20h3v3h-3z'/%3E%3C/g%3E%3C/svg%3E\");\n}\n\n.icon--library {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath clip-rule='evenodd' d='M15.373 22h1.258c.28-.32.616-.597.995-.819 1.478-.862 4.005-.909 5.386.109H24.5v-9.2s-.797-2.25-4.42-2.25c-1.875 0-2.902.602-3.456 1.184a2.568 2.568 0 00-.6.976h-.048a2.569 2.569 0 00-.6-.976c-.554-.582-1.581-1.184-3.456-1.184-3.623 0-4.42 2.25-4.42 2.25v9.19h1.488c1.382-1.019 3.91-.97 5.388-.105.38.223.717.503.997.825zm1.127-9.711v8.457c.195-.157.403-.3.622-.428.927-.541 2.115-.796 3.241-.787 1.006.008 2.081.227 2.952.759h.185v-7.973a2.414 2.414 0 00-.505-.595c-.46-.397-1.33-.882-2.915-.882-1.586 0-2.34.483-2.695.835a1.749 1.749 0 00-.353.49 1.076 1.076 0 00-.052.131l-.005.017.001-.006.002-.008v-.005l.001-.002v-.002l-.005-.001zm-1 0h-.474l-.006.001v.002l.001.002.001.005.002.008.001.006-.005-.017a1.076 1.076 0 00-.053-.131 1.749 1.749 0 00-.353-.49c-.354-.351-1.108-.835-2.694-.835-1.585 0-2.455.485-2.916.882a2.411 2.411 0 00-.504.595v7.963h.185c.872-.532 1.948-.752 2.954-.759 1.128-.008 2.316.249 3.243.792.217.127.424.27.618.426z' fill='%23000' fill-rule='evenodd'/%3E%3C/svg%3E\");\n}\n\n.icon--link-broken {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000'%3E%3Cpath d='M18 14v-2a2 2 0 10-4 0v2h-1v-2a3 3 0 116 0v2zM19 18h-1v2a2 2 0 11-4 0v-2h-1v2a3 3 0 106 0z'/%3E%3C/g%3E%3C/svg%3E\");\n}\n\n.icon--link-connected {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000'%3E%3Cpath d='M16 10a2 2 0 012 2v2h1v-2a3 3 0 10-6 0v2h1v-2a2 2 0 012-2zM18 18h1v2a3 3 0 11-6 0v-2h1v2a2 2 0 104 0z'/%3E%3Cpath d='M15.5 13v6h1v-6z'/%3E%3C/g%3E%3C/svg%3E\");\n}\n\n.icon--list-detailed {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000'%3E%3Cpath d='M12 10h-2v1h2zM12 20h-2v1h2zM10 15h2v1h-2zM22 10h-8v1h8zM14 20h8v1h-8zM22 15h-8v1h8z'/%3E%3C/g%3E%3C/svg%3E\");\n}\n\n.icon--list-tile {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath clip-rule='evenodd' d='M14 11h-3v3h3zm-4-1v5h5v-5zm11 1h-3v3h3zm-4-1v5h5v-5zm-3 8h-3v3h3zm-4-1v5h5v-5zm11 1h-3v3h3zm-4-1v5h5v-5z' fill='%23000' fill-rule='evenodd'/%3E%3C/svg%3E\");\n}\n\n.icon--list {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000' fill-opacity='.8'%3E%3Cpath d='M23 10H9v1h14zM9 15.5h14v1H9zM9 21h14v1H9z'/%3E%3C/g%3E%3C/svg%3E\");\n}\n\n.icon--lock-off {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M18 15h.5a.5.5 0 01.5.5v5a.5.5 0 01-.5.5h-6a.5.5 0 01-.5-.5v-5a.5.5 0 01.5-.5H17v-2.5a2.5 2.5 0 015 0V14h-1v-1.5a1.5 1.5 0 00-3 0z' fill='%23000'/%3E%3C/svg%3E\");\n}\n\n.icon--lock-on {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath clip-rule='evenodd' d='M13.5 15v-1.5a2.5 2.5 0 015 0V15h.5a.5.5 0 01.5.5v5a.5.5 0 01-.5.5h-6a.5.5 0 01-.5-.5v-5a.5.5 0 01.5-.5zm4-1.5V15h-3v-1.5a1.5 1.5 0 013 0z' fill='%23000' fill-rule='evenodd'/%3E%3C/svg%3E\");\n}\n\n.icon--minus {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M21.5 16.5h-11v-1h11z' fill='%23000'/%3E%3C/svg%3E\");\n}\n\n.icon--play {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath clip-rule='evenodd' d='M13 10.098L22.443 16 13 21.902zm1 1.804v8.196L20.557 16z' fill='%23000' fill-rule='evenodd'/%3E%3C/svg%3E\");\n}\n\n.icon--plus {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M15.5 15.5v-5h1v5h5v1h-5v5h-1v-5h-5v-1z' fill='%23000'/%3E%3C/svg%3E\");\n}\n\n.icon--random {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000'%3E%3Cpath clip-rule='evenodd' d='M15.118 11a2.5 2.5 0 00-1.335.386L11.228 13H18.5v1h-8.497a.512.512 0 00-.003.051V20.5c0 .278.223.5.497.5h7.628a.498.498 0 00.328-.123l3.206-2.805a1 1 0 00.341-.753V11.5a.5.5 0 00-.5-.5zm-1.869-.46a3.5 3.5 0 011.87-.54H21.5a1.5 1.5 0 011.5 1.5v5.82a2 2 0 01-.683 1.504l-3.205 2.805c-.274.24-.624.371-.987.371h-7.627C9.668 22 9 21.327 9 20.5v-6.449a1.5 1.5 0 01.699-1.268z' fill-rule='evenodd'/%3E%3Cpath d='M13 16a1 1 0 11-2 0 1 1 0 012 0zM17 16a1 1 0 11-2 0 1 1 0 012 0zM17 19a1 1 0 11-2 0 1 1 0 012 0zM13 19a1 1 0 11-2 0 1 1 0 012 0z'/%3E%3Cg clip-rule='evenodd' fill-rule='evenodd'%3E%3Cpath d='M22.407 10.71a.5.5 0 01-.116.697l-3.5 2.5a.5.5 0 01-.582-.814l3.5-2.5a.5.5 0 01.698.116z'/%3E%3Cpath d='M18 21v-8h1v8z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\");\n}\n\n.icon--recent {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000'%3E%3Cpath d='M15 12v5h5v-1h-4v-4z'/%3E%3Cpath clip-rule='evenodd' d='M24 16a8 8 0 11-16 0 8 8 0 0116 0zm-1 0a7 7 0 11-14 0 7 7 0 0114 0z' fill-rule='evenodd'/%3E%3C/g%3E%3C/svg%3E\");\n}\n\n.icon--resize-to-fit {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000'%3E%3Cpath d='M8.646 9.354L12.293 13H10v1h4v-4h-1v2.293L9.354 8.646zM19.707 13l3.647-3.646-.707-.708L19 12.293V10h-1v4h4v-1zM19.707 19l3.647 3.646-.707.708L19 19.707V22h-1v-4h4v1zM12.293 19l-3.647 3.646.708.708L13 19.707V22h1v-4h-4v1z'/%3E%3C/g%3E%3C/svg%3E\");\n}\n\n.icon--resolve-filled {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath clip-rule='evenodd' d='M16 24a8 8 0 100-16 8 8 0 000 16zm3.911-9.635l-.822-.73-3.613 4.064-2.587-2.588-.778.778 3.413 3.412z' fill='%23000' fill-rule='evenodd'/%3E%3C/svg%3E\");\n}\n\n.icon--resolve {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000'%3E%3Cpath d='M19.911 14.365l-.822-.73-3.613 4.063-2.587-2.587-.778.778 3.413 3.412z'/%3E%3Cpath clip-rule='evenodd' d='M24 16a8 8 0 11-16 0 8 8 0 0116 0zm-1 0a7 7 0 11-14 0 7 7 0 0114 0z' fill-rule='evenodd'/%3E%3C/g%3E%3C/svg%3E\");\n}\n\n.icon--reverse {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath clip-rule='evenodd' d='M15.854 8.646L18.207 11l-2.353 2.354-.708-.708 1.147-1.146H14c-.503 0-1.27.155-1.895.606-.6.432-1.105 1.157-1.105 2.394v7.25h-1V14.5c0-1.563.662-2.588 1.52-3.206.833-.6 1.817-.794 2.48-.794h2.293l-1.147-1.146zM22 10v7.25c0 1.563-.662 2.588-1.52 3.206-.833.6-1.817.794-2.48.794h-2.293l1.147 1.146-.708.708-2.353-2.354 2.353-2.354.708.708-1.147 1.146H18c.503 0 1.27-.155 1.895-.606.6-.432 1.105-1.157 1.105-2.394V10z' fill='%23000' fill-rule='evenodd'/%3E%3C/svg%3E\");\n}\n\n.icon--search-large {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath clip-rule='evenodd' d='M18.874 19.581a6 6 0 11.707-.707l4.273 4.272-.708.708zM20 15a5 5 0 11-10 0 5 5 0 0110 0z' fill='%23000' fill-rule='evenodd'/%3E%3C/svg%3E\");\n}\n\n.icon--search {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath clip-rule='evenodd' d='M18.397 18.605a4.552 4.552 0 11.707-.707l3.25 3.249-.708.707zm.706-3.553a3.552 3.552 0 11-7.103 0 3.552 3.552 0 017.103 0z' fill='%23000' fill-rule='evenodd'/%3E%3C/svg%3E\");\n}\n\n.icon--settings {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cg clip-rule='evenodd' fill='%23000' fill-rule='evenodd'%3E%3Cpath d='M16.954 9.928l-.139-.331C16.635 9.165 16.301 9 16 9s-.635.165-.815.597l-.139.331c-.56 1.343-1.992 2.13-3.425 1.72l-.5-.144c-.309-.088-.606.025-.815.327a1.05 1.05 0 00-.049 1.123c.743 1.323.402 3.068-.86 3.95-.318.222-.456.614-.375 1.024.081.409.342.668.673.723l.195.033c1.525.253 2.51 1.687 2.423 3.18-.03.503.22.861.52 1.028.288.161.623.155.921-.108l.373-.33a2.8 2.8 0 013.746 0l.373.33c.298.264.633.27.922.108.3-.167.549-.525.52-1.028-.088-1.493.897-2.927 2.423-3.18l.194-.033c.33-.055.592-.314.673-.723.081-.41-.057-.802-.375-1.024-1.262-.882-1.603-2.627-.86-3.95a1.05 1.05 0 00-.05-1.123c-.208-.302-.505-.415-.815-.327l-.499.143c-1.433.41-2.865-.376-3.425-1.719zm.784-.717c-.674-1.615-2.802-1.615-3.476 0l-.138.332c-.383.917-1.326 1.401-2.228 1.143l-.499-.143c-1.575-.45-2.855 1.398-2.012 2.9.505.9.257 2.07-.56 2.64-1.392.973-.933 3.282.706 3.555l.195.032c.96.16 1.65 1.09 1.588 2.135-.104 1.788 1.82 2.864 3.103 1.727l.373-.33a1.8 1.8 0 012.42 0l.373.33c1.284 1.137 3.207.061 3.103-1.727-.061-1.046.628-1.975 1.589-2.135l.194-.032c1.639-.273 2.098-2.582.707-3.554-.818-.572-1.066-1.742-.561-2.64.843-1.503-.437-3.352-2.012-2.901l-.5.143c-.9.258-1.844-.226-2.226-1.143z'/%3E%3Cpath d='M16 18.5a2 2 0 100-4 2 2 0 000 4zm0 1a3 3 0 100-6 3 3 0 000 6z'/%3E%3C/g%3E%3C/svg%3E\");\n}\n\n.icon--share {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath clip-rule='evenodd' d='M20 9.5a3.5 3.5 0 00-1.383 6.716A4.513 4.513 0 0016 18.436a4.513 4.513 0 00-2.618-2.22 3.501 3.501 0 10-2.764 0A4.502 4.502 0 007.5 20.5V22h17v-1.5c0-2.003-1.309-3.7-3.118-4.284A3.501 3.501 0 0020 9.5zM17.5 13a2.5 2.5 0 115 0 2.5 2.5 0 01-5 0zm-1 8v-.5a3.5 3.5 0 117 0v.5zm-1-.5v.5h-7v-.5a3.5 3.5 0 117 0zm-6-7.5a2.5 2.5 0 115 0 2.5 2.5 0 01-5 0z' fill='%23000' fill-rule='evenodd'/%3E%3C/svg%3E\");\n}\n\n.icon--smiley {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000'%3E%3Cpath d='M16 20a4.002 4.002 0 01-3.874-3h1.045a3.001 3.001 0 005.658 0h1.045A4.002 4.002 0 0116 20zM19.5 14.125a.875.875 0 11-1.75 0 .875.875 0 011.75 0zM13.125 15a.875.875 0 100-1.75.875.875 0 000 1.75z'/%3E%3Cpath clip-rule='evenodd' d='M24 16a8 8 0 11-16 0 8 8 0 0116 0zm-1 0a7 7 0 11-14 0 7 7 0 0114 0z' fill-rule='evenodd'/%3E%3C/g%3E%3C/svg%3E\");\n}\n\n.icon--sort-alpha-asc {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cg clip-rule='evenodd' fill='%23000' fill-rule='evenodd'%3E%3Cpath d='M10.897 9L9 14h1.07l.379-1h2.133l.338 1h1.056l-1.69-5zm1.347 3l-.667-1.973L10.828 12zM12.553 19H9.5v-1H14v.979L10.932 22H14v1H9.5v-.993zM20.5 8.293l3.354 3.353-.708.708L21 10.207V23h-1V10.207l-2.146 2.147-.708-.708z'/%3E%3C/g%3E%3C/svg%3E\");\n}\n\n.icon--sort-alpha-dsc {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cg clip-rule='evenodd' fill='%23000' fill-rule='evenodd'%3E%3Cpath d='M10.897 9L9 14h1.07l.379-1h2.133l.338 1h1.056l-1.69-5zm1.347 3l-.667-1.973L10.828 12zM12.553 19H9.5v-1H14v.979L10.932 22H14v1H9.5v-.993zM20 21.793V9h1v12.793l2.146-2.147.708.708-3.354 3.353-3.354-3.353.708-.708z'/%3E%3C/g%3E%3C/svg%3E\");\n}\n\n.icon--sort-top-bottom {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath clip-rule='evenodd' d='M20.45 12H10v-1h10.45c.97 0 1.372 1.244.584 1.812L11.05 20h9.243l-1.647-1.646.708-.708 2.853 2.854-2.853 2.854-.708-.708L20.293 21H11.05c-.97 0-1.372-1.244-.584-1.812z' fill='%23000' fill-rule='evenodd'/%3E%3C/svg%3E\");\n}\n\n.icon--spacing {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M22 11h-2v10h2v1h-3V10h3zm-10-1v12H9v-1h2V11H9v-1zm4 3h-1v6h1z' fill='%23000'/%3E%3C/svg%3E\");\n}\n\n.icon--spinner {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath clip-rule='evenodd' d='M15.165 8.53a.5.5 0 01-.404.58A7 7 0 1023 16a.5.5 0 011 0 8 8 0 11-9.416-7.874.5.5 0 01.58.404z' fill='%23000' fill-rule='evenodd'/%3E%3C/svg%3E\");\n}\n\n.icon--star-off {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath clip-rule='evenodd' d='M18 14.004L16 8l-2 6.004H8L12.96 18l-1.904 6L16 20l4.944 4-1.904-6L24 14zm3.165.998l-3.886.002L16 11.164l-1.28 3.84h-3.885l3.285 2.646-1.103 3.477L16 18.714l2.983 2.413-1.103-3.476z' fill='%23000' fill-rule='evenodd'/%3E%3C/svg%3E\");\n}\n\n.icon--star-on {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M16 8l2 6.004L24 14l-4.96 4 1.904 6L16 20l-4.944 4 1.904-6L8 14.004h6z' fill='%23000'/%3E%3C/svg%3E\");\n}\n\n.icon--stroke-weight {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath clip-rule='evenodd' d='M10 10h12v1H10zm0 4h12v2H10zm12 5H10v3h12z' fill='%23000' fill-rule='evenodd'/%3E%3C/svg%3E\");\n}\n\n.icon--styles {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000'%3E%3Cpath d='M11.5 13a1.5 1.5 0 103 0 1.5 1.5 0 00-3 0zM17.5 13a1.5 1.5 0 103 0 1.5 1.5 0 00-3 0zM19 20.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM11.5 19a1.5 1.5 0 103 0 1.5 1.5 0 00-3 0z'/%3E%3C/g%3E%3C/svg%3E\");\n}\n\n.icon--swap {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000'%3E%3Cpath d='M23 13.188l-1.175 1.468a5.5 5.5 0 00-10.003-2.219l.83.557a4.5 4.5 0 018.216 2.057l-2.2-1.467-.555.832 3.381 2.254 2.287-2.858zM9 17.188l.78.624 1.176-1.468.026.156a5.5 5.5 0 009.976 2.065v-.002l-.83-.557-.001.001a4.5 4.5 0 01-8.214-2.058l2.2 1.467.555-.832-3.382-2.254z'/%3E%3C/g%3E%3C/svg%3E\");\n}\n\n.icon--theme {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000'%3E%3Cpath clip-rule='evenodd' d='M13 10h-3v12h3zm-3-1a1 1 0 00-1 1v12a1 1 0 001 1h3a1 1 0 001-1V10a1 1 0 00-1-1z' fill-rule='evenodd'/%3E%3Cpath d='M10.75 20.5a.75.75 0 111.5 0 .75.75 0 01-1.5 0zM22 18a1 1 0 011 1v3a1 1 0 01-1 1h-7v-1h7v-3h-7v-1zM18.385 17l2.757-2.757a1 1 0 000-1.415l-2.121-2.12a1 1 0 00-1.414 0L15 13.313v1.414l3.314-3.314 2.121 2.122L16.971 17z'/%3E%3C/g%3E%3C/svg%3E\");\n}\n\n.icon--tidy-up-grid {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000'%3E%3Cpath d='M10 10h2v2h-2zM20 10h2v2h-2zM12 15h-2v2h2zM20 15h2v2h-2zM12 20h-2v2h2zM20 20h2v2h-2zM17 10h-2v2h2zM15 15h2v2h-2zM17 20h-2v2h2z'/%3E%3C/g%3E%3C/svg%3E\");\n}\n\n.icon--tidy-up-list-horizontal {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000'%3E%3Cpath d='M10 22.5v-13h2v13zM15 22.5v-13h2v13zM20 9.5v13h2v-13z'/%3E%3C/g%3E%3C/svg%3E\");\n}\n\n.icon--tidy-up-list-vertical {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000'%3E%3Cpath d='M9.5 10h13v2h-13zM9.5 15h13v2h-13zM22.5 20h-13v2h13z'/%3E%3C/g%3E%3C/svg%3E\");\n}\n\n.icon--timer {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000'%3E%3Cpath d='M19 8h-6V7h6zM16.5 17v-5h-1v5a.5.5 0 001 0z'/%3E%3Cpath clip-rule='evenodd' d='M22.715 12.65l1.527-1.529L22.122 9l-1.483 1.482a8 8 0 102.075 2.167zM23 17a7 7 0 11-2.384-5.263l.647.647A6.974 6.974 0 0123 17zm-1.008-5.3l.13.128.706-.707-.707-.707-.701.701c.2.185.391.38.572.585z' fill-rule='evenodd'/%3E%3C/g%3E%3C/svg%3E\");\n}\n\n.icon--trash {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000'%3E%3Cpath d='M14 18.5v-4h1v4zM17 18.5v-4h1v4z'/%3E%3Cpath clip-rule='evenodd' d='M19 10.5a2 2 0 00-2-2h-2a2 2 0 00-2 2h-3v1h1v10a2 2 0 002 2h6a2 2 0 002-2v-10h1v-1zm-4-1a1 1 0 00-1 1h4a1 1 0 00-1-1zm5 2h-8v10a1 1 0 001 1h6a1 1 0 001-1z' fill-rule='evenodd'/%3E%3C/g%3E%3C/svg%3E\");\n}\n\n.icon--vertical-padding {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000'%3E%3Cpath d='M9 9h14v1H9zm0 13h14v1H9z'/%3E%3Cpath clip-rule='evenodd' d='M19 13h-6v6h6zm-7-1v8h8v-8z' fill-rule='evenodd'/%3E%3C/g%3E%3C/svg%3E\");\n}\n\n.icon--visible {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000'%3E%3Cpath d='M16 18a2 2 0 100-4 2 2 0 000 4z'/%3E%3Cpath clip-rule='evenodd' d='M16 12a7.499 7.499 0 016.635 4A7.499 7.499 0 0116 20a7.499 7.499 0 01-6.635-4A7.499 7.499 0 0116 12zm0 7a6.495 6.495 0 01-5.478-3A6.495 6.495 0 0116 13c2.3 0 4.322 1.194 5.478 3A6.495 6.495 0 0116 19z' fill-rule='evenodd'/%3E%3C/g%3E%3C/svg%3E\");\n}\n\n.icon--warning-large {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath clip-rule='evenodd' d='M16 6l10 18H6zm-1 11v-4h2v4zm0 2v2h2v-2z' fill='%23000' fill-rule='evenodd'/%3E%3C/svg%3E\");\n}\n\n.icon--warning {\n  background-image: url(\"data:image/svg+xml;charset=utf8,%3Csvg fill='none' height='32' width='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath clip-rule='evenodd' d='M16 9l8 14H8zm-1 8.5V14h2v3.5zm0 1.5v2h2v-2z' fill='%23000' fill-rule='evenodd'/%3E%3C/svg%3E\");\n}\n\n.icon-button {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  cursor: pointer;\n  width: var(--size-medium);\n  height: var(--size-medium);\n  border-radius: var(--border-radius-small);\n  border: 2px solid transparent;\n}\n\n.icon-button * {\n  filter: invert(0%) sepia(0%) saturate(7500%) hue-rotate(117deg) brightness(109%) contrast(105%);\n}\n\n.icon-button:hover {\n  background: var(--hover-fill);\n}\n\n.icon-button:active, .icon-button:focus {\n  border: 2px solid var(--blue);\n  outline: none;\n}\n\n.icon-button--selected {\n  background-color: var(--blue);\n}\n\n.icon-button--selected:hover {\n  background-color: var(--blue);\n}\n\n.icon-button--selected:active, .icon-button--selected:focus {\n  border: 2px solid var(--black3);\n}\n\n.icon-button--selected * {\n  filter: invert(100%) sepia(100%) saturate(0%) hue-rotate(269deg) brightness(103%) contrast(104%);\n}\n\n.input {\n  position: relative;\n}\n\n.input__field {\n  font-size: var(--font-size-xsmall);\n  font-weight: var(--font-weight-normal);\n  letter-spacing: var(--font-letter-spacing-neg-xsmall);\n  line-height: var(--line-height);\n  position: relative;\n  display: flex;\n  overflow: visible;\n  align-items: center;\n  width: 100%;\n  height: 30px;\n  margin: 1px 0 1px 0;\n  padding: var(--size-xxsmall) var(--size-xxxsmall) var(--size-xxsmall) var(--size-xxsmall);\n  color: var(--black8);\n  border: 1px solid var(--black1);\n  border-radius: var(--border-radius-small);\n  outline: none;\n  background-color: var(--white);\n}\n\n.input__field:hover, .input__field:placeholder-shown:hover {\n  color: var(--black8);\n  border: 1px solid var(--black1);\n  background-image: none;\n}\n\n.input__field::-moz-selection {\n  color: var(--black);\n  background-color: var(--blue3);\n}\n\n.input__field::selection {\n  color: var(--black);\n  background-color: var(--blue3);\n}\n\n.input__field::-moz-placeholder {\n  color: var(--black3);\n  border: 1px solid transparent;\n}\n\n.input__field:-ms-input-placeholder {\n  color: var(--black3);\n  border: 1px solid transparent;\n}\n\n.input__field::placeholder {\n  color: var(--black3);\n  border: 1px solid transparent;\n}\n\n.input__field:placeholder-shown {\n  border: 1px solid var(--black1);\n}\n\n.input__field:focus:placeholder-shown {\n  border: 1px solid var(--blue);\n  outline: 1px solid var(--blue);\n  outline-offset: -2px;\n}\n\n.input__field:disabled:hover {\n  border: 1px solid transparent;\n}\n\n.input__field:active, .input__field:focus {\n  color: var(--black);\n  border: 1px solid var(--blue);\n  outline: 1px solid var(--blue);\n  outline-offset: -2px;\n}\n\n.input__field:disabled {\n  position: relative;\n  color: var(--black3);\n  -webkit-user-select: none;\n     -moz-user-select: none;\n      -ms-user-select: none;\n          user-select: none;\n}\n\n.input__field:disabled:active {\n  outline: none;\n}\n\n.input--with-icon .input__field {\n  padding-left: 32px;\n}\n\n.input--borders {\n  border: 1px solid var(--black1);\n}\n\n.input .icon {\n  position: absolute;\n  top: 0px;\n  left: 0;\n  width: var(--size-medium);\n  height: var(--size-medium);\n  z-index: 1;\n  opacity: 0.3;\n}\n\n.label {\n  font-size: var(--font-size-xsmall);\n  font-weight: var(--font-weight-normal);\n  letter-spacing: var(--font-letter-spacing-pos-xsmall);\n  line-height: var(--line-height);\n  color: var(--black3);\n  height: var(--size-medium);\n  width: 100%;\n  display: flex;\n  align-items: center;\n  cursor: default;\n  -webkit-user-select: none;\n     -moz-user-select: none;\n      -ms-user-select: none;\n          user-select: none;\n  padding: 0 var(--size-xxxsmall) 0 var(--size-xxsmall);\n}\n\n.onboarding-tip {\n  display: flex;\n  align-items: flex-start;\n  padding: 0 var(--size-xsmall) 0 0;\n}\n\n.onboarding-tip .icon {\n  margin-right: var(--size-xxsmall);\n  flex: none;\n}\n\n.onboarding-tip__msg {\n  padding: var(--size-xxsmall) 0 var(--size-xxsmall) 0;\n  font-size: var(--font-size-xsmall);\n  font-weight: var(--font-weight-normal);\n  letter-spacing: var(--font-letter-spacing-pos-xsmall);\n  line-height: var(--line-height);\n  color: var(--black8);\n  margin: 0;\n}\n\n.radio {\n  align-items: center;\n  cursor: default;\n  display: flex;\n  height: var(--size-medium);\n  position: relative;\n}\n\n.radio__button {\n  opacity: 0;\n  width: 10px;\n  height: 10px;\n  margin: 0;\n  padding: 0;\n}\n\n.radio__button:checked + .radio__label:before {\n  background-image: url('data:image/svg+xml,%3Csvg width=\"6\" height=\"6\" viewBox=\"0 0 6 6\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Crect width=\"6\" height=\"6\" rx=\"3\" fill=\"black\" fill-opacity=\"0.8\"/%3E%3C/svg%3E%0A');\n  background-repeat: no-repeat;\n  background-position: 2px 2px;\n}\n\n.radio__button:disabled + .radio__label {\n  opacity: 0.3;\n}\n\n.radio__button:checked:disabled + .radio__label:before {\n  border: 1px solid var(--black);\n}\n\n.radio__label {\n  align-items: center;\n  color: var(--black8);\n  display: flex;\n  font-family: var(--font-stack);\n  font-size: var(--font-size-xsmall);\n  font-weight: var(--font-weight-normal);\n  line-height: var(--font-line-height);\n  letter-spacing: var(--font-letter-spacing-pos-xsmall);\n  margin-left: -16px;\n  padding: 0 var(--size-xsmall) 0 var(--size-small);\n  height: 100%;\n  -webkit-user-select: none;\n     -moz-user-select: none;\n      -ms-user-select: none;\n          user-select: none;\n}\n\n.radio__label:before {\n  border: 1px solid var(--black8);\n  border-radius: var(--border-radius-small);\n  content: '';\n  display: block;\n  width: 10px;\n  height: 10px;\n  margin: 2px 10px 0 -8px;\n  border-radius: 50%;\n}\n\n.section-title {\n  font-size: var(--font-size-xsmall);\n  font-weight: var(--font-weight-bold);\n  letter-spacing: var(--font-letter-spacing-pos-xsmall);\n  line-height: var(--line-height);\n  color: var(--black8);\n  height: var(--size-medium);\n  width: 100%;\n  display: flex;\n  align-items: center;\n  cursor: default;\n  -webkit-user-select: none;\n     -moz-user-select: none;\n      -ms-user-select: none;\n          user-select: none;\n  padding: 0 calc(var(--size-xxsmall) / 2) 0 var(--size-xxsmall);\n}\n\nselect.select-menu {\n  display: none;\n}\n\n.select-menu {\n  position: relative;\n}\n\n.select-menu__button {\n  display: flex;\n  align-items: center;\n  border: 1px solid transparent;\n  height: 30px;\n  width: 100%;\n  margin: 1px 0 1px 0;\n  padding: 0px var(--size-xxsmall) 0px var(--size-xxsmall);\n  overflow-y: hidden;\n  border-radius: var(--border-radius-small);\n  background-color: var(--white);\n}\n\n.select-menu__button:hover {\n  border-color: var(--black1);\n}\n\n.select-menu__button:focus {\n  border: 1px solid var(--blue);\n  outline: 1px solid var(--blue);\n  outline-offset: -2px;\n}\n\n.select-menu__button:disabled:hover {\n  justify-content: flex-start;\n  border-color: transparent;\n}\n\n.select-menu__button * {\n  pointer-events: none;\n}\n\n.select-menu__button:hover .select-menu__label--placeholder {\n  color: var(--black8);\n}\n\n.select-menu__button:focus .select-menu__label--placeholder {\n  color: var(--black8);\n}\n\n.select-menu__button:disabled:hover .select-menu__label--placeholder {\n  color: var(--black3);\n}\n\n.select-menu__button:hover .select-menu__caret, .select-menu__button:focus .select-menu__caret {\n  opacity: 1.0;\n  margin-left: auto;\n}\n\n.select-menu__button:disabled:hover .select-menu__caret {\n  opacity: 0.3;\n  margin-left: -12px;\n}\n\n.select-menu__button:disabled .select-menu__label {\n  color: var(--black3);\n}\n\n.select-menu__label {\n  font-size: var(--font-size-xsmall);\n  font-weight: var(--font-weight-normal);\n  letter-spacing: var(--font-letter-spacing-neg-xsmall);\n  line-height: var(--line-height);\n  color: var(--black8);\n  margin-right: 6px;\n  margin-top: -2px;\n  white-space: nowrap;\n  overflow-x: hidden;\n  text-overflow: ellipsis;\n}\n\n.select-menu__label--placeholder {\n  color: var(--black3);\n}\n\n.select-menu__caret {\n  width: 30px;\n  height: 30px;\n  display: block;\n  margin-top: -1px;\n  margin-left: -12px;\n  background-image: url(\"data:image/svg+xml;utf8,%3Csvg%20fill%3D%22none%22%20height%3D%2230%22%20viewBox%3D%220%200%2030%2030%22%20width%3D%2230%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20clip-rule%3D%22evenodd%22%20d%3D%22m15%2016.7071-3-3%20.7071-.7071%202.6465%202.6464%202.6464-2.6464.7071.7071-3%203-.3535.3536z%22%20fill%3D%22%23000%22%20fill-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E\");\n  background-repeat: no-repeat;\n  background-position: center center;\n  opacity: 0.3;\n}\n\n.select-menu .icon {\n  margin-left: -8px;\n  margin-top: -2px;\n  margin-right: 0;\n  opacity: 0.3;\n}\n\n.select-menu__menu {\n  display: none;\n  position: absolute;\n  top: 0;\n  left: 0;\n  width: 100%;\n  background-color: var(--hud);\n  box-shadow: var(--shadow-hud);\n  padding: var(--size-xxsmall) 0 var(--size-xxsmall) 0;\n  border-radius: var(--border-radius-small);\n  margin: 0;\n  z-index: 1000;\n  overflow-x: overlay;\n  overflow-y: auto;\n}\n\n.select-menu__menu--active {\n  display: block;\n}\n\n.select-menu__menu::-webkit-scrollbar {\n  width: 12px;\n  background-color: transparent;\n  background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=);\n  background-repeat: repeat;\n  background-size: 100% auto;\n}\n\n.select-menu__menu::-webkit-scrollbar-track {\n  border: solid 3px transparent;\n  box-shadow: inset 0 0 10px 10px transparent;\n}\n\n.select-menu__menu::-webkit-scrollbar-thumb {\n  border: solid 3px transparent;\n  border-radius: 6px;\n  box-shadow: inset 0 0 10px 10px rgba(255, 255, 255, 0.4);\n}\n\n.select-menu__item {\n  align-items: center;\n  color: var(--white);\n  cursor: default;\n  display: flex;\n  font-family: var(--font-stack);\n  font-size: var(--font-size-small);\n  font-weight: var(--font-weight-normal);\n  letter-spacing: var(--font-letter-spacing-neg-xsmall);\n  line-height: var(--font-line-height);\n  height: var(--size-small);\n  padding: 0px var(--size-xsmall) 0px var(--size-xxsmall);\n  -webkit-user-select: none;\n     -moz-user-select: none;\n      -ms-user-select: none;\n          user-select: none;\n  outline: none;\n}\n\n.select-menu__item--selected .select-menu__item-icon {\n  opacity: 1.0;\n}\n\n.select-menu__item-label {\n  overflow-x: hidden;\n  white-space: nowrap;\n  text-overflow: ellipsis;\n  pointer-events: none;\n}\n\n.select-menu__item-icon {\n  width: var(--size-xsmall);\n  height: var(--size-xsmall);\n  margin-right: var(--size-xxsmall);\n  opacity: 0;\n  pointer-events: none;\n  background-image: url(\"data:image/svg+xml;utf8,%3Csvg%20fill%3D%22none%22%20height%3D%2216%22%20viewBox%3D%220%200%2016%2016%22%20width%3D%2216%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20clip-rule%3D%22evenodd%22%20d%3D%22m13.2069%205.20724-5.50002%205.49996-.70711.7072-.70711-.7072-3-2.99996%201.41422-1.41421%202.29289%202.29289%204.79293-4.79289z%22%20fill%3D%22%23fff%22%20fill-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E\");\n  background-repeat: no-repeat;\n  background-position: center center;\n}\n\n.select-menu--highlight, .select-menu__item:hover, .select-menu__item:focus {\n  background-color: var(--blue);\n}\n\n.select-menu__divider-label {\n  font-size: var(--font-size-small);\n  font-weight: var(--font-weight-normal);\n  letter-spacing: var(--font-letter-spacing-neg-small);\n  line-height: var(--line-height);\n  display: flex;\n  align-items: center;\n  height: var(--size-small);\n  padding: 0 var(--size-xxsmall) 0 var(--size-medium);\n  color: var(--white4);\n  margin-top: 0;\n}\n\n.select-menu__divider {\n  background-color: var(--white2);\n  display: block;\n  height: 1px;\n  margin: 8px 0 7px 0;\n}\n\n.switch {\n  align-items: center;\n  cursor: default;\n  display: flex;\n  height: var(--size-medium);\n  position: relative;\n  /*\n    &__toggle:focus + &__label:before {\n        box-shadow: 0 0 0 2px var(--blue);\n    }\n    */\n}\n\n.switch__toggle {\n  opacity: 0;\n}\n\n.switch__toggle:checked + .switch__label:before {\n  color: var(--black8);\n  background-color: var(--black8-opaque);\n}\n\n.switch__toggle:checked + .switch__label:after {\n  transform: translateX(12px);\n}\n\n.switch__toggle:checked:disabled + .switch__label:before {\n  border: 1px solid var(--black);\n  background-color: var(--black);\n}\n\n.switch__toggle:disabled + .switch__label {\n  color: var(--black);\n  opacity: 0.3;\n}\n\n.switch__label {\n  align-items: center;\n  color: var(--black8);\n  display: flex;\n  font-family: var(--font-stack);\n  font-size: var(--font-size-xsmall);\n  font-weight: var(--font-weight-normal);\n  height: 100%;\n  letter-spacing: var(--font-letter-spacing-pos-xsmall);\n  line-height: var(--font-line-height);\n  margin-left: -16px;\n  padding: 0 var(--size-xsmall) 0 calc(var(--size-xlarge) - 2px);\n  -webkit-user-select: none;\n     -moz-user-select: none;\n      -ms-user-select: none;\n          user-select: none;\n}\n\n.switch__label:before {\n  background-color: var(--white);\n  border: 1px solid var(--black8-opaque);\n  border-radius: 6px;\n  content: '';\n  display: block;\n  height: 10px;\n  left: 8px;\n  position: absolute;\n  top: 10px;\n  transition: background-color 0 0.2s;\n  width: 22px;\n}\n\n.switch__label:after {\n  background-color: var(--white);\n  border: 1px solid var(--black8-opaque);\n  border-radius: 50%;\n  content: '';\n  display: block;\n  height: 10px;\n  left: 8px;\n  position: absolute;\n  top: 10px;\n  transition: transform 0.2s;\n  width: 10px;\n}\n\n.textarea {\n  font-size: var(--font-size-xsmall);\n  font-weight: var(--font-weight-normal);\n  letter-spacing: var(--font-letter-spacing-neg-xsmall);\n  line-height: var(--line-height);\n  position: relative;\n  display: flex;\n  overflow: visible;\n  align-items: center;\n  width: 100%;\n  min-height: 62px;\n  margin: 1px 0 1px 0;\n  padding: var(--size-xxsmall) var(--size-xxxsmall) var(--size-xxsmall) var(--size-xxsmall);\n  color: var(--black8);\n  border: 1px solid var(--black1);\n  border-radius: var(--border-radius-small);\n  outline: none;\n  background-color: var(--white);\n  resize: none;\n  overflow-y: auto;\n}\n\n.textarea:hover, .textarea:placeholder-shown:hover {\n  color: var(--black8);\n  border: 1px solid var(--black1);\n  background-image: none;\n}\n\n.textarea::-moz-selection {\n  color: var(--black);\n  background-color: var(--blue3);\n}\n\n.textarea::selection {\n  color: var(--black);\n  background-color: var(--blue3);\n}\n\n.textarea::-moz-placeholder {\n  color: var(--black3);\n  border: 1px solid transparent;\n}\n\n.textarea:-ms-input-placeholder {\n  color: var(--black3);\n  border: 1px solid transparent;\n}\n\n.textarea::placeholder {\n  color: var(--black3);\n  border: 1px solid transparent;\n}\n\n.textarea:focus:placeholder-shown {\n  border: 1px solid var(--blue);\n  outline: 1px solid var(--blue);\n  outline-offset: -2px;\n}\n\n.textarea:active, .textarea:focus {\n  color: var(--black);\n  border: 1px solid var(--blue);\n  outline: 1px solid var(--blue);\n  outline-offset: -2px;\n}\n\n.textarea:disabled, .textarea:disabled:hover {\n  position: relative;\n  color: var(--black3);\n  border: 1px solid transparent;\n}\n\n.textarea:disabled:active {\n  outline: none;\n}\n\n.type {\n  font-family: var(--font-stack);\n  font-size: var(--font-size-xsmall);\n  font-weight: var(--font-weight-normal);\n  line-height: var(--font-line-height);\n  letter-spacing: var(--font-letter-spacing-pos-xsmall);\n  /* sizes */\n  /* weights */\n  /* letter spacing adjustments based pos/neg application */\n}\n\n.type--small {\n  font-size: var(--font-size-small);\n  letter-spacing: var(--font-letter-spacing-pos-small);\n}\n\n.type--large {\n  font-size: var(--font-size-large);\n  line-height: var(--font-line-height-large);\n  letter-spacing: var(--font-letter-spacing-pos-large);\n}\n\n.type--xlarge {\n  font-size: var(--font-size-xlarge);\n  line-height: var(--font-line-height-large);\n  letter-spacing: var(--font-letter-spacing-pos-xlarge);\n}\n\n.type--medium {\n  font-weight: var(--font-weight-medium);\n}\n\n.type--bold {\n  font-weight: var(--font-weight-bold);\n}\n\n.type--inverse {\n  letter-spacing: var(--font-letter-spacing-neg-xsmall);\n}\n\n.type--inverse + .type--small {\n  letter-spacing: var(--font-letter-spacing-neg-small);\n}\n\n.type--inverse + .type--large {\n  letter-spacing: var(--font-letter-spacing-neg-large);\n}\n\n.type--inverse + .type--xlarge {\n  letter-spacing: var(--font-letter-spacing-neg-xlarge);\n}\n\n.type--inline {\n  display: inline-block;\n}\n";
    styleInject(css_248z$1);

    const MESSAGE = {
        INIT_PARAMS: "INIT_PARAMS",
        INIT_STYLES: "INIT_STYLES",
        SYNC_STYLES: "SYNC_STYLES",
    };

    var css_248z = ".type.svelte-37r2s4.svelte-37r2s4{line-height:125%}.type--secondary.svelte-37r2s4.svelte-37r2s4{color:var(--figma-color-text-secondary)}.type--tertiary.svelte-37r2s4.svelte-37r2s4{color:var(--figma-color-text-tertiary)}.input__field.svelte-37r2s4.svelte-37r2s4{color:var(--figma-color-text);border:1px solid var(--figma-color-border);background-color:var(--figma-color-bg)}.input__field.svelte-37r2s4.svelte-37r2s4:hover,.input__field.svelte-37r2s4.svelte-37r2s4:placeholder-shown:hover{color:var(--figma-color-text);border:1px solid var(--figma-color-border)}.input__field.svelte-37r2s4.svelte-37r2s4::selection{color:var(--figma-color-text);background-color:var(--figma-color-bg-selected)}.input__field.svelte-37r2s4.svelte-37r2s4::placeholder{color:var(--figma-color-text-disabled)}.input__field.svelte-37r2s4.svelte-37r2s4:placeholder-shown{border:1px solid var(--figma-color-border)}.input__field.svelte-37r2s4.svelte-37r2s4:focus:placeholder-shown{border:1px solid var(--figma-color-border-selected);outline:1px solid var(--figma-color-border-selected)}.input__field.svelte-37r2s4.svelte-37r2s4:active,.input__field.svelte-37r2s4.svelte-37r2s4:focus{color:var(--figma-color-text);border:1px solid var(--figma-color-border-selected);outline:1px solid var(--figma-color-border-selected);outline-offset:-2px}.input__field.svelte-37r2s4.svelte-37r2s4:disabled{color:var(--figma-color-text-disabled)}.button.svelte-37r2s4.svelte-37r2s4{color:var(--white)}.button--primary.svelte-37r2s4.svelte-37r2s4{background-color:var(--figma-color-bg-brand)}.button--primary.svelte-37r2s4.svelte-37r2s4:enabled:active,.button--primary.svelte-37r2s4.svelte-37r2s4:enabled:focus{border:2px solid var(--figma-color-border-selected)}.button--primary.svelte-37r2s4.svelte-37r2s4:enabled:active{background-color:var(--figma-color-bg-brand-pressed)}.button--primary.svelte-37r2s4.svelte-37r2s4:disabled{background-color:var(--figma-color-border-disabled);color:var(--figma-color-text-disabled)}.button--secondary.svelte-37r2s4.svelte-37r2s4{background-color:var(--figma-color-bg);border:1px solid var(--figma-color-text);color:var(--figma-color-text)}.button--secondary.svelte-37r2s4.svelte-37r2s4:enabled:active,.button--secondary.svelte-37r2s4.svelte-37r2s4:enabled:focus{border:2px solid var(--figma-color-border-selected)}.button--secondary.svelte-37r2s4.svelte-37r2s4:enabled:active{background-color:var(--figma-color-bg-pressed)}.button--secondary.svelte-37r2s4.svelte-37r2s4:disabled{border:1px solid var(--figma-color-border-disabled);color:var(--figma-color-text-disabled)}.checkbox__label.svelte-37r2s4.svelte-37r2s4{color:var(--figma-color-text)}.checkbox__label.svelte-37r2s4.svelte-37r2s4:before{border:1px solid var(--figma-color-text)}.checkbox__box.svelte-37r2s4:disabled+.checkbox__label.svelte-37r2s4{color:var(--figma-color-text)}.checkbox__box.svelte-37r2s4:checked+.checkbox__label.svelte-37r2s4:before{background-color:var(--figma-color-bg-brand);border:1px solid var(--figma-color-border-brand)}.checkbox__box.svelte-37r2s4:checked:disabled+.checkbox__label.svelte-37r2s4:before{background-color:var(--figma-color-text)}.content.svelte-37r2s4.svelte-37r2s4{height:100vh;width:100%;display:grid;grid-template-columns:1fr 200px;grid-template-rows:256px auto;grid-gap:1px;background-color:var(--figma-color-border);color:var(--figma-color-text)}.container.svelte-37r2s4.svelte-37r2s4{flex:1 1 50%;height:100%;width:100%;display:flex;flex-direction:column;justify-content:space-between;padding:16px 16px 16px;background-color:var(--figma-color-bg)}.container.preview.svelte-37r2s4.svelte-37r2s4{background-color:var(--figma-color-bg-secondary);padding:0}.preview-header.svelte-37r2s4.svelte-37r2s4{padding:12px 16px;border-bottom:1px solid var(--figma-color-border)}.input-content.svelte-37r2s4.svelte-37r2s4{display:flex;flex-direction:column;gap:4px}.button-row.svelte-37r2s4.svelte-37r2s4{display:flex;gap:8px}.style-list.svelte-37r2s4.svelte-37r2s4{width:100%;display:flex;flex-direction:column;gap:20px;flex:1 1 100%;overflow-y:auto;padding:16px;scroll-padding-top:16px;scroll-padding-bottom:16px}.style-list.svelte-37r2s4.svelte-37r2s4::-webkit-scrollbar{display:none}.opacity-list.svelte-37r2s4.svelte-37r2s4{display:flex;flex-direction:column;gap:12px}.color-style.svelte-37r2s4.svelte-37r2s4{display:flex;flex-direction:row;align-items:center;gap:8px}.color-style-circle.svelte-37r2s4.svelte-37r2s4{position:relative;height:16px;width:16px;border-radius:50%}.color-style-circle__checkered.svelte-37r2s4.svelte-37r2s4{position:absolute;height:16px;width:16px;border-radius:50%;background:linear-gradient(45deg, rgba(0, 0, 0, 0.0980392) 25%, transparent 25%, transparent 75%, rgba(0, 0, 0, 0.0980392) 75%, rgba(0, 0, 0, 0.0980392) 0), linear-gradient(45deg, rgba(0, 0, 0, 0.0980392) 25%, transparent 25%, transparent 75%, rgba(0, 0, 0, 0.0980392) 75%, rgba(0, 0, 0, 0.0980392) 0), white;background-repeat:repeat, repeat;background-position:0px 0, 4px 4px;transform-origin:0 0 0;background-origin:padding-box, padding-box;background-clip:border-box, border-box;background-size:8px 8px, 8px 8px}.color-style-circle__opaque.svelte-37r2s4.svelte-37r2s4{position:absolute;height:16px;width:16px;border-radius:50%;background:linear-gradient(45deg, var(--figma-color-bg-secondary) 50%, transparent 50%)}.color-style-circle__solid.svelte-37r2s4.svelte-37r2s4{position:absolute;height:16px;width:16px;border-radius:50%}.color-style-circle__border.svelte-37r2s4.svelte-37r2s4{position:absolute;height:18px;width:18px;left:-1px;top:-1px;border-radius:50%;box-shadow:inset 0 0 0 1.5px var(--figma-color-bg-secondary)}.color-style-text.svelte-37r2s4.svelte-37r2s4{overflow-x:hidden;text-overflow:ellipsis;white-space:nowrap}.footer.svelte-37r2s4.svelte-37r2s4{background-color:var(--figma-color-bg);grid-column:1/span 2;display:flex;align-items:center;justify-content:space-between;padding:0 16px}";
    styleInject(css_248z);

    /* src/app.svelte generated by Svelte v3.58.0 */

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[13] = list[i];
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[16] = list[i];
    	return child_ctx;
    }

    // (123:10) {#each opacitiesList as opacityItem}
    function create_each_block_1(ctx) {
    	let div5;
    	let div4;
    	let div0;
    	let t0;
    	let div1;
    	let t1;
    	let div2;
    	let t2;
    	let div3;
    	let t3;
    	let span;

    	let t4_value = (/*matchNamePattern*/ ctx[5](/*patternValue*/ ctx[2], {
    		N: /*stylesItem*/ ctx[13].name,
    		A: /*opacityItem*/ ctx[16]
    	}) || "Untitled") + "";

    	let t4;

    	return {
    		c() {
    			div5 = element("div");
    			div4 = element("div");
    			div0 = element("div");
    			t0 = space();
    			div1 = element("div");
    			t1 = space();
    			div2 = element("div");
    			t2 = space();
    			div3 = element("div");
    			t3 = space();
    			span = element("span");
    			t4 = text(t4_value);
    			attr(div0, "class", "color-style-circle__checkered svelte-37r2s4");
    			attr(div1, "class", "color-style-circle__opaque svelte-37r2s4");
    			attr(div2, "class", "color-style-circle__solid svelte-37r2s4");
    			set_style(div2, "background-color", `rgba(${/*stylesItem*/ ctx[13].color.r * 255}, ${/*stylesItem*/ ctx[13].color.g * 255}, ${/*stylesItem*/ ctx[13].color.b * 255}, ${/*opacityItem*/ ctx[16] / 100})`);
    			attr(div3, "class", "color-style-circle__border svelte-37r2s4");
    			attr(div4, "class", "color-style-circle svelte-37r2s4");
    			attr(span, "class", "color-style-text type type--small svelte-37r2s4");
    			attr(div5, "class", "color-style svelte-37r2s4");
    		},
    		m(target, anchor) {
    			insert(target, div5, anchor);
    			append(div5, div4);
    			append(div4, div0);
    			append(div4, t0);
    			append(div4, div1);
    			append(div4, t1);
    			append(div4, div2);
    			append(div4, t2);
    			append(div4, div3);
    			append(div5, t3);
    			append(div5, span);
    			append(span, t4);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*stylesList, opacitiesList*/ 18) {
    				set_style(div2, "background-color", `rgba(${/*stylesItem*/ ctx[13].color.r * 255}, ${/*stylesItem*/ ctx[13].color.g * 255}, ${/*stylesItem*/ ctx[13].color.b * 255}, ${/*opacityItem*/ ctx[16] / 100})`);
    			}

    			if (dirty & /*patternValue, stylesList, opacitiesList*/ 22 && t4_value !== (t4_value = (/*matchNamePattern*/ ctx[5](/*patternValue*/ ctx[2], {
    				N: /*stylesItem*/ ctx[13].name,
    				A: /*opacityItem*/ ctx[16]
    			}) || "Untitled") + "")) set_data(t4, t4_value);
    		},
    		d(detaching) {
    			if (detaching) detach(div5);
    		}
    	};
    }

    // (103:6) {#each stylesList as stylesItem}
    function create_each_block(ctx) {
    	let div6;
    	let span0;
    	let t0_value = /*stylesItem*/ ctx[13].name + "";
    	let t0;
    	let t1;
    	let div5;
    	let div4;
    	let div0;
    	let t2;
    	let div1;
    	let t3;
    	let div2;
    	let t4;
    	let div3;
    	let t5;
    	let span1;
    	let t6_value = /*stylesItem*/ ctx[13].name + "";
    	let t6;
    	let t7;
    	let t8;
    	let each_value_1 = /*opacitiesList*/ ctx[4];
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	return {
    		c() {
    			div6 = element("div");
    			span0 = element("span");
    			t0 = text(t0_value);
    			t1 = space();
    			div5 = element("div");
    			div4 = element("div");
    			div0 = element("div");
    			t2 = space();
    			div1 = element("div");
    			t3 = space();
    			div2 = element("div");
    			t4 = space();
    			div3 = element("div");
    			t5 = space();
    			span1 = element("span");
    			t6 = text(t6_value);
    			t7 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t8 = space();
    			attr(span0, "class", "type type--small type--secondary svelte-37r2s4");
    			attr(div0, "class", "color-style-circle__checkered svelte-37r2s4");
    			attr(div1, "class", "color-style-circle__opaque svelte-37r2s4");
    			attr(div2, "class", "color-style-circle__solid svelte-37r2s4");
    			set_style(div2, "background-color", `rgba(${/*stylesItem*/ ctx[13].color.r * 255}, ${/*stylesItem*/ ctx[13].color.g * 255}, ${/*stylesItem*/ ctx[13].color.b * 255}, 1)`);
    			attr(div3, "class", "color-style-circle__border svelte-37r2s4");
    			attr(div4, "class", "color-style-circle svelte-37r2s4");
    			attr(span1, "class", "type type--small svelte-37r2s4");
    			attr(div5, "class", "color-style svelte-37r2s4");
    			attr(div6, "class", "opacity-list svelte-37r2s4");
    		},
    		m(target, anchor) {
    			insert(target, div6, anchor);
    			append(div6, span0);
    			append(span0, t0);
    			append(div6, t1);
    			append(div6, div5);
    			append(div5, div4);
    			append(div4, div0);
    			append(div4, t2);
    			append(div4, div1);
    			append(div4, t3);
    			append(div4, div2);
    			append(div4, t4);
    			append(div4, div3);
    			append(div5, t5);
    			append(div5, span1);
    			append(span1, t6);
    			append(div6, t7);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(div6, null);
    				}
    			}

    			append(div6, t8);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*stylesList*/ 2 && t0_value !== (t0_value = /*stylesItem*/ ctx[13].name + "")) set_data(t0, t0_value);

    			if (dirty & /*stylesList*/ 2) {
    				set_style(div2, "background-color", `rgba(${/*stylesItem*/ ctx[13].color.r * 255}, ${/*stylesItem*/ ctx[13].color.g * 255}, ${/*stylesItem*/ ctx[13].color.b * 255}, 1)`);
    			}

    			if (dirty & /*stylesList*/ 2 && t6_value !== (t6_value = /*stylesItem*/ ctx[13].name + "")) set_data(t6, t6_value);

    			if (dirty & /*matchNamePattern, patternValue, stylesList, opacitiesList*/ 54) {
    				each_value_1 = /*opacitiesList*/ ctx[4];
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div6, t8);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_1.length;
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(div6);
    			destroy_each(each_blocks, detaching);
    		}
    	};
    }

    function create_fragment(ctx) {
    	let div13;
    	let div6;
    	let span0;
    	let t1;
    	let div1;
    	let label0;
    	let t3;
    	let div0;
    	let input0;
    	let t4;
    	let span1;
    	let t6;
    	let div5;
    	let div2;
    	let t8;
    	let div3;
    	let input1;
    	let t9;
    	let div4;
    	let button0;
    	let t11;
    	let button1;
    	let t13;
    	let div10;
    	let div8;
    	let t15;
    	let div9;
    	let t16;
    	let div12;
    	let div11;
    	let input2;
    	let t17;
    	let label1;
    	let t19;
    	let button2;
    	let t20;
    	let button2_disabled_value;
    	let mounted;
    	let dispose;
    	let each_value = /*stylesList*/ ctx[1];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	return {
    		c() {
    			div13 = element("div");
    			div6 = element("div");
    			span0 = element("span");
    			span0.textContent = "Sync and update solid colors and matching opacity styles in the local\n      library.";
    			t1 = space();
    			div1 = element("div");
    			label0 = element("label");
    			label0.textContent = "Opacity styles:";
    			t3 = space();
    			div0 = element("div");
    			input0 = element("input");
    			t4 = space();
    			span1 = element("span");
    			span1.textContent = "Enter values in [0-100] range separated with commas";
    			t6 = space();
    			div5 = element("div");
    			div2 = element("div");
    			div2.textContent = "Name pattern:";
    			t8 = space();
    			div3 = element("div");
    			input1 = element("input");
    			t9 = space();
    			div4 = element("div");
    			button0 = element("button");
    			button0.textContent = "Style name";
    			t11 = space();
    			button1 = element("button");
    			button1.textContent = "Opacity";
    			t13 = space();
    			div10 = element("div");
    			div8 = element("div");
    			div8.innerHTML = `<div class="type type--small type--bold svelte-37r2s4">Preview</div>`;
    			t15 = space();
    			div9 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t16 = space();
    			div12 = element("div");
    			div11 = element("div");
    			input2 = element("input");
    			t17 = space();
    			label1 = element("label");
    			label1.textContent = "Clean up unused opacity styles";
    			t19 = space();
    			button2 = element("button");
    			t20 = text("Create & sync styles");
    			attr(span0, "class", "type type--small type--secondary svelte-37r2s4");
    			attr(label0, "for", "opacity-styles");
    			attr(label0, "class", "type svelte-37r2s4");
    			attr(input0, "id", "opacity-styles");
    			attr(input0, "name", "opacity-styles");
    			attr(input0, "type", "input");
    			attr(input0, "class", "input__field svelte-37r2s4");
    			attr(input0, "placeholder", "e.g. 10, 20, 40, 60, 80");
    			attr(div0, "class", "input");
    			attr(span1, "class", "type type--tertiary svelte-37r2s4");
    			attr(div1, "class", "input-content svelte-37r2s4");
    			attr(div2, "class", "type svelte-37r2s4");
    			attr(input1, "type", "input");
    			attr(input1, "class", "input__field svelte-37r2s4");
    			attr(input1, "placeholder", "e.g. $N - $A%");
    			attr(div3, "class", "input");
    			attr(button0, "class", "button button--secondary svelte-37r2s4");
    			attr(button1, "class", "button button--secondary svelte-37r2s4");
    			attr(div4, "class", "button-row svelte-37r2s4");
    			attr(div5, "class", "input-content svelte-37r2s4");
    			attr(div6, "class", "container svelte-37r2s4");
    			attr(div8, "class", "preview-header svelte-37r2s4");
    			attr(div9, "class", "style-list svelte-37r2s4");
    			attr(div10, "class", "container preview svelte-37r2s4");
    			attr(input2, "id", "shouldClean");
    			attr(input2, "type", "checkbox");
    			attr(input2, "class", "checkbox__box svelte-37r2s4");
    			attr(label1, "for", "shouldClean");
    			attr(label1, "class", "checkbox__label svelte-37r2s4");
    			attr(div11, "class", "checkbox");
    			attr(button2, "class", "button button--primary svelte-37r2s4");
    			button2.disabled = button2_disabled_value = /*opacitiesValue*/ ctx[0] === "" || /*patternValue*/ ctx[2] === "";
    			attr(div12, "class", "footer svelte-37r2s4");
    			attr(div13, "class", "content svelte-37r2s4");
    		},
    		m(target, anchor) {
    			insert(target, div13, anchor);
    			append(div13, div6);
    			append(div6, span0);
    			append(div6, t1);
    			append(div6, div1);
    			append(div1, label0);
    			append(div1, t3);
    			append(div1, div0);
    			append(div0, input0);
    			set_input_value(input0, /*opacitiesValue*/ ctx[0]);
    			append(div1, t4);
    			append(div1, span1);
    			append(div6, t6);
    			append(div6, div5);
    			append(div5, div2);
    			append(div5, t8);
    			append(div5, div3);
    			append(div3, input1);
    			set_input_value(input1, /*patternValue*/ ctx[2]);
    			append(div5, t9);
    			append(div5, div4);
    			append(div4, button0);
    			append(div4, t11);
    			append(div4, button1);
    			append(div13, t13);
    			append(div13, div10);
    			append(div10, div8);
    			append(div10, t15);
    			append(div10, div9);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(div9, null);
    				}
    			}

    			append(div13, t16);
    			append(div13, div12);
    			append(div12, div11);
    			append(div11, input2);
    			input2.checked = /*shouldCleanValue*/ ctx[3];
    			append(div11, t17);
    			append(div11, label1);
    			append(div12, t19);
    			append(div12, button2);
    			append(button2, t20);

    			if (!mounted) {
    				dispose = [
    					listen(input0, "input", /*input0_input_handler*/ ctx[8]),
    					listen(input1, "input", /*input1_input_handler*/ ctx[9]),
    					listen(button0, "click", /*click_handler*/ ctx[10]),
    					listen(button1, "click", /*click_handler_1*/ ctx[11]),
    					listen(input2, "change", /*input2_change_handler*/ ctx[12]),
    					listen(button2, "click", /*handleClick*/ ctx[7])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*opacitiesValue*/ 1) {
    				set_input_value(input0, /*opacitiesValue*/ ctx[0]);
    			}

    			if (dirty & /*patternValue*/ 4) {
    				set_input_value(input1, /*patternValue*/ ctx[2]);
    			}

    			if (dirty & /*opacitiesList, matchNamePattern, patternValue, stylesList*/ 54) {
    				each_value = /*stylesList*/ ctx[1];
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div9, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (dirty & /*shouldCleanValue*/ 8) {
    				input2.checked = /*shouldCleanValue*/ ctx[3];
    			}

    			if (dirty & /*opacitiesValue, patternValue*/ 5 && button2_disabled_value !== (button2_disabled_value = /*opacitiesValue*/ ctx[0] === "" || /*patternValue*/ ctx[2] === "")) {
    				button2.disabled = button2_disabled_value;
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div13);
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	let opacitiesList;
    	let stylesList = [];
    	let patternValue = "$N $A%";
    	let opacitiesValue = "80, 60, 40, 20, 10";
    	let shouldCleanValue = false;

    	onmessage = event => {
    		switch (event.data.pluginMessage.type) {
    			case MESSAGE.INIT_STYLES:
    				$$invalidate(1, stylesList = event.data.pluginMessage.styles);
    				break;
    			case MESSAGE.INIT_PARAMS:
    				const { opacities, pattern, shouldClean } = event.data.pluginMessage.params;
    				if (opacities) $$invalidate(0, opacitiesValue = opacities.join(", "));
    				if (pattern) $$invalidate(2, patternValue = pattern);
    				if (shouldClean) $$invalidate(3, shouldCleanValue = shouldClean);
    				break;
    		}

    		return;
    	};

    	const matchNamePattern = (input, variables) => {
    		const pattern = /\$(N|A)/g;

    		const replaced = input.replace(pattern, (match, name) => {
    			const value = variables[name];
    			return value !== undefined ? value : match;
    		});

    		return replaced;
    	};

    	const handlePatternAdd = value => {
    		$$invalidate(2, patternValue += value);
    	};

    	const handleClick = () => {
    		parent.postMessage(
    			{
    				pluginMessage: {
    					type: MESSAGE.SYNC_STYLES,
    					opacities: opacitiesList,
    					pattern: patternValue,
    					shouldClean: shouldCleanValue
    				}
    			},
    			"*"
    		);
    	};

    	function input0_input_handler() {
    		opacitiesValue = this.value;
    		$$invalidate(0, opacitiesValue);
    	}

    	function input1_input_handler() {
    		patternValue = this.value;
    		$$invalidate(2, patternValue);
    	}

    	const click_handler = () => handlePatternAdd("$N");
    	const click_handler_1 = () => handlePatternAdd("$A");

    	function input2_change_handler() {
    		shouldCleanValue = this.checked;
    		$$invalidate(3, shouldCleanValue);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*opacitiesValue*/ 1) {
    			$$invalidate(4, opacitiesList = opacitiesValue.split(",").map(x => parseInt(x.trim())).sort((a, b) => b - a).filter(x => x >= 0 && x <= 100));
    		}
    	};

    	return [
    		opacitiesValue,
    		stylesList,
    		patternValue,
    		shouldCleanValue,
    		opacitiesList,
    		matchNamePattern,
    		handlePatternAdd,
    		handleClick,
    		input0_input_handler,
    		input1_input_handler,
    		click_handler,
    		click_handler_1,
    		input2_change_handler
    	];
    }

    class App extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance, create_fragment, safe_not_equal, {});
    	}
    }

    const app = new App({
      target: document.body,
    });

    return app;

}));