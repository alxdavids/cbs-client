/*
 * @author: Alex Davidson
 */

"use strict";
const btoa = require('btoa');
const atob = require('atob');
const rewire = require('rewire');
const createShake256 = require('./challenge-bypass-extension/addon/scripts/keccak.js');
const testCommitment = require('./test-config.js')
const src = rewire('./challenge-bypass-extension/addon/compiled/test_compiled.js');
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
src.__set__("XMLHttpRequest", XMLHttpRequest);

// define and set localStorage
const localStorage = require('node-localstorage');
localStorage.getItem = function(k) { return localStorage[k]; }
localStorage.setItem = function(k, v) { localStorage[k] = v; }
src.__set__('localStorage', localStorage);

// set other stuff
src.__set__('atob', atob);
src.__set__('btoa', btoa);
src.__set__('createShake256', createShake256);

// choose config
const setConfig = src.__get__("setConfig");
setConfig(1);
src.__set__('activeG', testCommitment["G"]);
src.__set__('activeH', testCommitment["H"]);

const funcs = {
    // Performs the scalar multiplication k*P
    //
    // Inputs:
    //  k: bigInt scalar (not field element or bits!)
    //  P: sjcl Point
    // Returns:
    //  sjcl Point
    _scalarMult: src.__get__("_scalarMult"),

    // blindPoint generates a random scalar blinding factor, multiplies the
    // supplied point by it, and returns both values.
    blindPoint: src.__get__("blindPoint"),

    // unblindPoint takes an assumed-to-be blinded point Q and an accompanying
    // blinding scalar b, then returns the point (1/b)*Q.
    //
    // inputs:
    //  b: bigint scalar (not field element or bits!)
    //  q: sjcl point
    // returns:
    //  sjcl point
    unblindPoint: src.__get__("unblindPoint"),

    // Derives the shared key used for redemption MACs
    //
    // Inputs:
    //  N: sjcl Point
    //  token: bytes
    // Returns:
    //  bytes
    deriveKey: src.__get__("deriveKey"),

    // Generates the HMAC used to bind request data to a particular token redemption.
    //
    // Inputs:
    //  key: raw key bytes as returned by deriveKey
    //  data: array of data as bytes
    // Returns:
    //  bytes
    createRequestBinding: src.__get__("createRequestBinding"),

    // Checks an HMAC generated by createRequestBinding
    //
    // Inputs:
    //  key: key bytes as returned by deriveKey
    //  data: data bytes
    //  mac: bytes of the MAC to check
    // Returns:
    //  true if valid, false otherwise
    checkRequestBinding: src.__get__("checkRequestBinding"),

    newRandomPoint: src.__get__("newRandomPoint"),

    // input: bits
    // output: point
    hashToCurve: src.__get__("hashToCurve"),

    // Attempts to decompress the bytes into a curve point following SEC1 and
    // assuming it's a Weierstrass curve with a = -3 and p = 3 mod 4 (true for the
    // main three NIST curves).
    // input: bits of an x coordinate, the even/odd tag
    // output: point
    decompressPoint: src.__get__("decompressPoint"),

    // Compresses a point according to SEC1.
    // input: point
    // output: base64-encoded bytes
    compressPoint: src.__get__("compressPoint"),

    // This has to match Go's elliptic.Marshal, which follows SEC1 2.3.3 for
    // uncompressed points.  SJCL's native point encoding is a concatenation of the
    // x and y coordinates, so it's *almost* SEC1 but lacks the tag for
    // uncompressed point encoding.
    //
    // Inputs:
    //  P: sjcl Point
    // Returns:
    //  bytes
    sec1EncodePoint: src.__get__("sec1EncodePoint"),

    // input: base64-encoded bytes
    // output: point
    sec1DecodePoint: src.__get__("sec1DecodePoint"),

    // Marshals a point in an SJCL-internal format that can be used with
    // JSON.stringify for localStorage.
    //
    // input: point
    // output: base64 string
    encodeStorablePoint: src.__get__("encodeStorablePoint"),

    // Renders a point from SJCL-internal base64.
    //
    // input: base64 string
    // ouput: point
    decodeStorablePoint: src.__get__("decodeStorablePoint"),

    /**
     * DLEQ proof verification logic
     */

    // Verifies the DLEQ proof that is returned when tokens are signed
    // 
    // input: marshaled JSON DLEQ proof
    // output: bool
    verifyProof: src.__get__("verifyProof"),

    // Recompute the composite M and Z values for verifying DLEQ
    recomputeComposites: src.__get__("recomputeComposites"),

    // Squeeze a seeded shake for output
    getShakeScalar: src.__get__("getShakeScalar"),

    getSeedPRNG: src.__get__("getSeedPRNG"),

    // Returns a decoded batch proof as a map
    retrieveProof: src.__get__("retrieveProof"),

    // Decode proof string and remove prefix
    getMarshaledBatchProof: src.__get__("getMarshaledBatchProof"),

    // Decode the proof that is sent into a map
    // 
    // input: Marshaled proof string
    // output: DLEQ proof
    parseDleqProof: src.__get__("parseDleqProof"),

    // Return a bignum from a base-64 encoded string
    getBigNumFromB64: src.__get__("getBigNumFromB64"),

    // Return a bignum from a hex string
    getBigNumFromHex: src.__get__("getBigNumFromHex"),

    // PRNG encode point
    encodePointForPRNG: src.__get__("encodePointForPRNG"),

    BuildRedeemHeader: src.__get__("BuildRedeemHeader"),

    getSjclBn: function(blind) {
        const bits = sjcl.codec.hex.toBits(blind);
        return sjcl.bn.fromBits(bits);
    },

    getSjclPoint: function(point) {
        const bits = sjcl.codec.base64.toBits(point);
        return p256.fromBits(bits);
    },

    CreateBlindToken: src.__get__("CreateBlindToken"),

    GenerateNewTokens: src.__get__("GenerateNewTokens"),

    BuildIssueRequest: src.__get__("BuildIssueRequest"),

    // Used for creating the correct encoding for storing tokens and signatures
    StoreTokens: function(tokens, signedPoints) {
        let storableTokens = [];
        for (var i = 0; i < tokens.length; i++) {
            let t = tokens[i];
            storableTokens[i] = this.getTokenEncoding(t,signedPoints[i]);
        }
        return storableTokens;
    },

    // SJCL points are cyclic as objects, so we have to flatten them.
    getTokenEncoding: src.__get__('getTokenEncoding'),

    GenerateWrappedRedemptionRequest: function(redStrB64, host, httpPath) {
		return JSON.stringify({ "bl_sig_req": redStrB64, "host": host, "http": httpPath});
	},
};

module.exports = funcs;
