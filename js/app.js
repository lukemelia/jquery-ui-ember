window.App = Em.Application.create();
App.initialize();

// Put jQuery UI inside its own namespace
JQ = {};

// Create a new mixin for jQuery UI widgets using the Ember
// mixin syntax.
JQ.Widget = Em.Mixin.create({
  // When Ember creates the view's DOM element, it will call this
  // method.
  didInsertElement: function() {
    // Make jQuery UI options available as Ember properties
    var options = this._gatherOptions();

    // Make sure that jQuery UI events trigger methods on this view.
    this._gatherEvents(options);

    // Create a new instance of the jQuery UI widget based on its `uiType`
    // and the current element.
    var ui = jQuery.ui[this.get('uiType')](options, this.get('element'));

    // Save off the instance of the jQuery UI widget as the `ui` property
    // on this Ember view.
    this.set('ui', ui);
  },

  // When Ember tears down the view's DOM element, it will call
  // this method.
  willDestroyElement: function() {
    var ui = this.get('ui');

    if (ui) {
      // Tear down any observers that were created to make jQuery UI
      // options available as Ember properties.
      var observers = this._observers;
      for (var prop in observers) {
        if (observers.hasOwnProperty(prop)) {
          this.removeObserver(prop, observers[prop]);
        }
      }
      ui._destroy();
    }
  },

  // Each jQuery UI widget has a series of options that can be configured.
  // For instance, to disable a button, you call
  // `button.options('disabled', true)` in jQuery UI. To make this compatible
  // with Ember bindings, any time the Ember property for a
  // given jQuery UI option changes, we update the jQuery UI widget.
  _gatherOptions: function() {
    var uiOptions = this.get('uiOptions'), options = {};

    // The view can specify a list of jQuery UI options that should be treated
    // as Ember properties.
    uiOptions.forEach(function(key) {
      options[key] = this.get(key);

      // Set up an observer on the Ember property. When it changes,
      // call jQuery UI's `setOption` method to reflect the property onto
      // the jQuery UI widget.
      var observer = function() {
        var value = this.get(key);
        this.get('ui')._setOption(key, value);
      };

      this.addObserver(key, observer);

      // Insert the observer in a Hash so we can remove it later.
      this._observers = this._observers || {};
      this._observers[key] = observer;
    }, this);

    return options;
  },

  // Each jQuery UI widget has a number of custom events that they can
  // trigger. For instance, the progressbar widget triggers a `complete`
  // event when the progress bar finishes. Make these events behave like
  // normal Ember events. For instance, a subclass of JQ.ProgressBar
  // could implement the `complete` method to be notified when the jQuery
  // UI widget triggered the event.
  _gatherEvents: function(options) {
    var uiEvents = this.get('uiEvents') || [], self = this;

    uiEvents.forEach(function(event) {
      var callback = self[event];

      if (callback) {
        // You can register a handler for a jQuery UI event by passing
        // it in along with the creation options. Update the options hash
        // to include any event callbacks.
        options[event] = function(event, ui) { callback.call(self, event, ui); };
      }
    });
  }
});

// Create a new Ember view for the jQuery UI Button widget
JQ.Button = Em.View.extend(JQ.Widget, {
  uiType: 'button',
  uiOptions: ['label', 'disabled'],

  tagName: 'button'
});

// Create a new Ember view for the jQuery UI Menu widget (new
// in jQuery UI 1.9). Because it wraps a collection, we extend from
// Ember's CollectionView rather than a normal view.
//
// This means that you should use `#collection` in your template to
// create this view.
JQ.Menu = Em.CollectionView.extend(JQ.Widget, {
  uiType: 'menu',
  uiOptions: ['disabled'],
  uiEvents: ['select'],

  tagName: 'ul',

  // Whenever the underlying Array for this `CollectionView` changes,
  // refresh the jQuery UI widget.
  arrayDidChange: function(content, start, removed, added) {
    this._super(content, start, removed, added);

    var ui = this.get('ui');
    if(ui) {
      // Schedule the refresh for after Ember has completed it's
      // render cycle
      Em.run.schedule('render', function(){
        ui.refresh();
      });
    }
  },
  itemViewClass: Em.View.extend({
    // Make it so that the default context for evaluating handlebars
    // bindings is the content of this child view. In a near-future
    // version of Ember, the leading underscore will be unnecessary.
    _context: function(){
      return this.get('content');
    }.property('content')
  })
});

// Create a new Ember view for the jQuery UI Progress Bar widget
JQ.ProgressBar = Em.View.extend(JQ.Widget, {
  uiType: 'progressbar',
  uiOptions: ['value', 'max'],
  uiEvents: ['change', 'complete']
});

// Create a simple controller to hold values that will be shared across
// views.
App.controller = Em.Object.create({
  progress: 0,
  menuDisabled: true,
  people: []
});

// Create a subclass of `JQ.Button` to define behavior for our button.
App.Button = JQ.Button.extend({
  // When the button is clicked...
  click: function() {
    // Disable the button.
    this.set('disabled', true);

    // Increment the progress bar.
    this.increment();
  },

  increment: function() {
    var self = this;

    // Get the current progress value from the controller.
    var val = App.controller.get('progress');

    if(val < 100) {
      // If the value is less than 100, increment it.
      App.controller.set('progress', val + 1);

      // Schedule another increment call from 30ms.
      setTimeout(function() { self.increment() }, 30);
    }
  }
});

// Create a subclass of `JQ.ProgressBar` to define behavior for our
// progress bar.
App.ProgressBar = JQ.ProgressBar.extend({
  // When the jQuery UI progress bar reaches 100%, it will invoke the
  // `complete` event. Recall that JQ.Widget registers a callback for
  // the `complete` event in `didInsertElement`, which calls the
  // `complete` method.
  complete: function() {
    // When the progress bar finishes, update App.controller with the
    // list of people. Because our template binds the JQ.Menu to this
    // value, it will automatically populate with the new people and
    // refresh the menu.
    App.controller.set('people', [
      Em.Object.create({
        name: "Tom DAAAAALE"
      }),
      Em.Object.create({
        name: "Yehuda Katz"
      }),
      Em.Object.create({
        name: "Selden Seen"
      })
    ]);

    // Set the `menuDisabled` property of our controller to false.
    // Because the JQ.Menu binds its `disabled` property to
    // App.controller.menuDisabled, this will enable it.
    App.controller.set('menuDisabled', false);
  }
});

/**
Template:

{{#with App.controller}}
  {{view App.Button label="Click to Load People"}}
  <br><br>
  {{view App.ProgressBar valueBinding="progress"}}
  <br><br>
  {{#collection JQ.Menu contentBinding="people" disabledBinding="menuDisabled"}}
    <a href="#">{{name}}</a>
  {{else}}
    <a href="#">LIST NOT LOADED</a>
  {{/collection}}
{{/with}}
*/
