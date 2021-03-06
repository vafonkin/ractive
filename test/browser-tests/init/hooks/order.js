import { test } from 'qunit';
import { initModule } from '../../test-config';

export default function() {
	initModule( 'init/hooks/order.js' );

	const hooks = [
		'onconfig',
		'oninit',
		'onrender',
		'onunrender',
		'onteardown'
	];

	test( 'basic order', t => {
		let options = {
			el: fixture,
			template: 'foo'
		};

		function addHook ( hook ) {
			options[ hook ] = function () {
				fired.push( hook );
			};
		}

		hooks.forEach( hook => addHook( hook ) );

		let fired = [];

		let ractive = new Ractive( options );
		ractive.teardown();
		t.deepEqual( fired, hooks );

		addHook( 'onconstruct');
		fired = [];

		const Component = Ractive.extend( options );
		ractive = new Component();
		ractive.teardown();
		t.deepEqual( fired, [ 'onconstruct' ].concat( hooks ) );
	});

	test( 'hooks call _super', t => {
		let superOptions = {};
		let options = {};

		let fired = [];

		hooks.forEach( hook => {
			superOptions[ hook ] = function () {
				fired.push( 'super' + hook );
			};
		});

		const Component = Ractive.extend( superOptions );

		options = {
			el: fixture,
			template: 'foo'
		};

		hooks.forEach( hook => {
			options[ hook ] = function ( arg ) {
				this._super( arg );
				fired.push( 'instance' + hook );
			};
		});

		const ractive = new Component( options );
		ractive.teardown();

		hooks.forEach( hook => {
			t.equal( fired.shift(), 'super' + hook );
			t.equal( fired.shift(), 'instance' + hook );
		});
	});

	test( 'Component hooks called in consistent order (gh #589)', t => {
		const done = t.async();

		// construct and config temporarily commented out, see #1381
		const method = {
			init: [],
			render: [],
			complete: [],
			unrender: [],
			teardown: []
		};

		const event = {
			init: [],
			render: [],
			complete: [],
			unrender: [],
			teardown: []
		};

		const simpsons = [ 'Homer', 'Marge', 'Lisa', 'Bart', 'Maggie' ];

		const Simpson = Ractive.extend({
			template: '{{simpson}}',
			onconstruct () {
				this.on('init', () => {
					event.init.push( this.get( 'simpson' ) );
				});
				this.on('render', () => {
					event.render.push( this.get( 'simpson' ) );
				});
				this.on('complete', () => {
					event.complete.push( this.get( 'simpson' ) );
				});
				this.on('unrender', () => {
					event.unrender.push( this.get( 'simpson' ) );
				});
				this.on('teardown', () => {
					event.teardown.push( this.get( 'simpson' ) );
				});
			},
			oninit () {
				method.init.push( this.get( 'simpson' ) );
			},
			onrender () {
				method.render.push( this.get( 'simpson' ) );
			},
			oncomplete () {
				method.complete.push( this.get( 'simpson' ) );
			},
			onunrender () {
				method.unrender.push( this.get( 'simpson' ) );
			},
			onteardown () {
				method.teardown.push( this.get( 'simpson' ) );
			}
		});

		const ractive = new Ractive({
			el: fixture,
			template: '{{#simpsons}}<Simpson simpson="{{this}}"/>{{/}}',
			data: { simpsons },
			components: { Simpson }
		});

		t.equal( fixture.innerHTML, simpsons.join( '' ) );

		ractive.teardown().then( () => {
			function testHooks( name, order ) {
				Object.keys( order ).forEach( hook => {
					if ( hook === 'complete' ) {
						t.equal( order.complete.length, simpsons.length );
					} else {
						t.deepEqual( order[ hook ], simpsons, `${hook} ${name} order` );
					}
				});
			}

			testHooks( 'method', method );
			testHooks( 'event', event );
			done();
		});
	});

	function testHierarchy ( hook, expected ) {
		test( hook, t => {
			const done = t.async();

			let fired = [];

			function getOptions ( level ) {
				let options = {};
				options[ hook ] = function () {
					fired.push( level );
				};
				return options;
			}

			let options = getOptions( 'grandchild' );
			options.template = '{{foo}}';
			const GrandChild = Ractive.extend( options );

			options = getOptions( 'child' );
			options.template = '<GrandChild/>';
			options.components = { GrandChild };
			const Child = Ractive.extend( options );

			options = getOptions( 'parent' );
			options.el = fixture;
			options.template = '<Child/>';
			options.data = { foo: 'bar' };
			options.components = { Child };
			const ractive = new Ractive(options);

			const grandchild = ractive.findComponent( 'GrandChild' );
			grandchild.set( 'foo', 'fizz' );

			ractive.teardown().then( () => {
				t.deepEqual( fired, expected );
				done();
			});
		});
	}

	const topDown = [ 'parent', 'child', 'grandchild' ];
	const bottomUp = [ 'grandchild', 'child', 'parent' ];

	testHierarchy( 'onconstruct', [ 'child', 'grandchild' ] );
	testHierarchy( 'onconfig', topDown );
	testHierarchy( 'oninit', topDown );
	testHierarchy( 'onrender', topDown );
	//testHierarchy( 'onchange', bottomUp ); commented out temporarily, see #1381
	testHierarchy( 'oncomplete', bottomUp );
	testHierarchy( 'onunrender', bottomUp );
	testHierarchy( 'onteardown', bottomUp );
}
