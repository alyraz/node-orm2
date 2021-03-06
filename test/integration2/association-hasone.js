var _				= require('lodash');
var should	 = require('should');
var helper	 = require('../support/spec_helper');
var async		= require('async');
var ORM			= require('../../');

describe("hasOne", function() {
	var db    = null;
	var Tree  = null;
	var Stalk = null;
	var Leaf  = null;
	var leafId = null;
	var treeId = null;
	var stalkId = null;

	var setup = function (opts) {
		opts = opts || {};
		return function (done) {
			db.settings.set('instance.cache', false);
			db.settings.set('instance.returnAllErrors', true);
			Tree  = db.define("tree",   { type:   { type: 'text' } });
			Stalk = db.define("stalk",  { length: { type: 'number', rational: false } });
			Leaf  = db.define("leaf", {
				size: { type: 'number', rational: false }
			}, {
				validations: opts.validations
			});
			Leaf.hasOne('tree',  Tree,  { field: 'treeId', autoFetch: !!opts.autoFetch });
			Leaf.hasOne('stalk', Stalk, { field: 'stalkId' });

			return helper.dropSync([Tree, Stalk, Leaf], function() {
				Tree.create({ type: 'pine' }, function (err, tree) {
					should.not.exist(err);
					treeId = tree.id;
					Leaf.create({ size: 14 }, function (err, leaf) {
						should.not.exist(err);
						leafId = leaf.id;
						leaf.setTree(tree, function (err) {
							should.not.exist(err);
							Stalk.create({ length: 20 }, function (err, stalk) {
								should.not.exist(err);
								should.exist(stalk);
								stalkId = stalk.id;
								done();
							});
						});
					});
				});
			});
		};
	};

	before(function(done) {
		helper.connect(function (connection) {
			db = connection;
			done();
		});
	});

	describe("accessors", function () {
		before(setup());

		it("get should get the association", function (done) {
			Leaf.one({ size: 14 }, function (err, leaf) {
				should.not.exist(err);
				should.exist(leaf);
				leaf.getTree(function (err, tree) {
					should.not.exist(err);
					should.exist(tree);
					return done();
				});
			});
		});

		it("get should get the association with a shell model", function (done) {
			Leaf(leafId).getTree(function (err, tree) {
				should.not.exist(err);
				should.exist(tree);
				should.equal(tree.id, treeId);
				done();
			});
		});

		it("has should indicate if there is an association present", function (done) {
			Leaf.one({ size: 14 }, function (err, leaf) {
				should.not.exist(err);
				should.exist(leaf);

				leaf.hasTree(function (err, has) {
					should.not.exist(err);
					should.equal(has, true);

					leaf.hasStalk(function (err, has) {
						should.not.exist(err);
						should.equal(has, false);
						return done();
					});
				});
			});
		});

		it("set should associate another instance", function (done) {
			Stalk.one({ length: 20 }, function (err, stalk) {
				should.not.exist(err);
				should.exist(stalk);
				Leaf.one({ size: 14 }, function (err, leaf) {
					should.not.exist(err);
					should.exist(leaf);
					should.not.exist(leaf.stalkId);
					leaf.setStalk(stalk, function (err) {
						should.not.exist(err);
						Leaf.one({ size: 14 }, function (err, leaf) {
							should.not.exist(err);
							should.equal(leaf.stalkId, stalk.id);
							done();
						});
					});
				});
			});
		});

		it("remove should unassociation another instance", function (done) {
			Stalk.one({ length: 20 }, function (err, stalk) {
				should.not.exist(err);
				should.exist(stalk);
				Leaf.one({ size: 14 }, function (err, leaf) {
					should.not.exist(err);
					should.exist(leaf);
					should.exist(leaf.stalkId);
					leaf.removeStalk(function (err) {
						should.not.exist(err);
						Leaf.one({ size: 14 }, function (err, leaf) {
							should.not.exist(err);
							should.equal(leaf.stalkId, null)
							done();
						});
					});
				});
			});
		});
	});

	[false, true].forEach(function (af) {
		describe("with autofetch = " + af, function () {
			before(setup({autoFetch: af}));

			describe("autofetching", function() {
				it((af ? "should" : "shouldn't") + " be done", function (done) {
					Leaf.one({}, function (err, leaf) {
						should.not.exist(err);
						should.equal(typeof leaf.tree, af ? 'object' : 'undefined');

						return done();
					});
				});
			});

			describe("associating by parent id", function () {
				var tree = null;

				before(function(done) {
					Tree.create({type: "cyprus"},  function (err, item) {
						should.not.exist(err);
						tree = item;

						return done();
					});
				});

				it("should work when calling Instance.save", function (done) {
					leaf = new Leaf({size: 4, treeId: tree.id});
					leaf.save(function(err, leaf) {
						should.not.exist(err);

						Leaf.get(leaf.id, function(err, fetchedLeaf) {
							should.not.exist(err);
							should.exist(fetchedLeaf);
							should.equal(fetchedLeaf.treeId, leaf.treeId);

							return done();
						});
					});
				});

				it("should work when calling Instance.save after initially setting parentId to null", function(done) {
					leaf = new Leaf({size: 4, treeId: null});
					leaf.treeId = tree.id;
					leaf.save(function(err, leaf) {
						should.not.exist(err);

						Leaf.get(leaf.id, function(err, fetchedLeaf) {
							should.not.exist(err);
							should.exist(fetchedLeaf);
							should.equal(fetchedLeaf.treeId, leaf.treeId);

							return done();
						});
					});
				});

				it("should work when specifying parentId in the save call", function (done) {
					leaf = new Leaf({size: 4});
					leaf.save({ treeId: tree.id }, function(err, leaf) {
						should.not.exist(err);

						should.exist(leaf.treeId);

						Leaf.get(leaf.id, function(err, fetchedLeaf) {
							should.not.exist(err);
							should.exist(fetchedLeaf);
							should.equal(fetchedLeaf.treeId, leaf.treeId);

							return done();
						});
					});
				});

				it("should work when calling Model.create", function (done) {
					Leaf.create({size: 4, treeId: tree.id}, function (err, leaf) {
						should.not.exist(err);

						Leaf.get(leaf.id, function(err, fetchedLeaf) {
							should.not.exist(err);

							should.exist(fetchedLeaf);
							should.equal(fetchedLeaf.treeId, leaf.treeId);

							return done();
						});
					});
				});
			});
		});
	});

	describe("validations", function () {
		before(setup({validations: { stalkId: ORM.validators.rangeNumber(undefined, 50) }}));

		it("should allow validating parentId", function (done) {
			Leaf.one({ size: 14 }, function (err, leaf) {
				should.not.exist(err);
				should.exist(leaf);

				leaf.save({ stalkId: 51	}, function( err, item ) {
					should(Array.isArray(err));
					should.equal(err.length, 1);
					should.equal(err[0].msg, 'out-of-range-number');

					done();
				});
			});
		});
	});
});
