/*jshint esversion: 6 */
/*jshint node: true */

/**
 * Contains utils mimicing the redemption functionality needed
 * from background.js at https://github.com/privacypass/challenge-bypass-extension
 */

"use strict";
const sjcl = require('./sjcl-local.js');
const p256 = sjcl.ecc.curves.c256;
const crypto = require('./crypto-local.js');
const atob = require('atob');
const btoa = require('btoa');

const funcs = {
	// Creates a redemption header for the specified request. The format is
	// base64(json(BlindTokenRequest)) where BlindTokenRequest corresponds to the
	// following Go struct:
	//
	// type BlindTokenRequest struct {
	//      Type     ReqType  `json:"type"`
	//      Contents [][]byte `json:"contents"`
	// }
	//
	// Note that Go will automatically render and decode []byte as base64 encoded
	// strings.
	//
	// For a redemption request, type will be "Redeem" and the contents will be a
	// list of [token preimage, HMAC(host, "%s %s" % (method, uri))] where the HMAC
	// key is derived from the signed point corresponding to the token preimage.
	BuildRedeemHeader: function(token, host, path) {
	    const sharedPoint = crypto.unblindPoint(funcs.getSjclBn(token.blind), funcs.getSjclPoint(token.point));
	    const derivedKey = crypto.deriveKey(sharedPoint, token.token);

	    const hostBits = sjcl.codec.utf8String.toBits(host);
	    const hostBytes = sjcl.codec.bytes.fromBits(hostBits);

	    const pathBits = sjcl.codec.utf8String.toBits(path);
	    const pathBytes = sjcl.codec.bytes.fromBits(pathBits);

	    const binding = crypto.createRequestBinding(derivedKey, [hostBytes, pathBytes]);

	    let contents = [];
	    contents.push(token.token);
	    contents.push(binding);

	    return btoa(JSON.stringify({ type: "Redeem", contents: contents}));
	},

	GenerateWrappedRedemptionRequest: function(redStrB64, host, httpPath) {
		return JSON.stringify({ "bl_sig_req": redStrB64, "host": host, "http": httpPath});
	},

	getSjclBn: function(blind) {
		const bits = sjcl.codec.hex.toBits(blind);
        return sjcl.bn.fromBits(bits);
	},

	getSjclPoint: function(point) {
		const bits = sjcl.codec.base64.toBits(point);
		return p256.fromBits(bits);
	}
};

module.exports = funcs;
