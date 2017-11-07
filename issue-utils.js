/*jshint esversion: 6 */
/*jshint node: true */

/**
 * Contains utils mimicing the issuance functionality needed
 * from background.js at https://github.com/privacypass/challenge-bypass-extension
 */

"use strict";
const crypto = require('./crypto-local.js');
const atob = require('atob');
const btoa = require('btoa');

// Parse the marshaled response from the server
function parseIssueResponse(data, n, tokens) {
    // decodes base-64
    const signaturesJSON = atob(data);
    // parses into JSON
    const issueResp = JSON.parse(signaturesJSON);
    let batchProof;
    let signatures;
    // Only separate the batch proof if it has been sent (it should be included in the
    // last element of the array).
    if (n == issueResp.length-1) {
        batchProof = issueResp[issueResp.length - 1];
        signatures = issueResp.slice(0, issueResp.length - 1);
    } else {
        signatures = issueResp;
    }

    let usablePoints = [];
    console.time('parse-all');
    signatures.forEach(function(signature) {
        let usablePoint = crypto.sec1DecodePoint(signature);
        if (usablePoint == null) {
            throw new Error("[privacy-pass]: unable to decode point " + signature + " in " + JSON.stringify(signatures));
        }
        usablePoints.push(usablePoint);
    });
    console.timeEnd('parse-all');

    // Verify the DLEQ batch proof before handing back the usable points
    console.time('verify-dleq');
    if (!crypto.verifyBatchProof(batchProof, tokens, usablePoints)) {
        throw new Error("[privacy-pass]: Unable to verify DLEQ proof.");
    }
    console.timeEnd('verify-dleq');

    return usablePoints;
}

// Generates n tokens and returns a wrapped issue request
function GenerateWrappedIssueRequest(n) {
    console.time('token-gen');
	const tokens = GenerateNewTokens(n);
    console.timeEnd('token-gen');
    console.time('issue-req');
	const issueReq = BuildIssueRequest(tokens);
    console.timeEnd('issue-req');
	return {wrap: WrapIssueRequest(issueReq), tokens: tokens};
}

// Wraps an issue request in the format needed for the
// server
function WrapIssueRequest(issueReqB64) {
	return JSON.stringify({ "bl_sig_req": issueReqB64 });
}

/**
 * [START] Functions taken from token.js
 */

function CreateBlindToken() {
    let t = crypto.newRandomPoint();
    let bpt = crypto.blindPoint(t.point);
    return { token: t.token, point: bpt.point, blind: bpt.blind };
}

function GenerateNewTokens(n) {
    let i = 0;
    let tokens = new Array(n);
    for (i = 0; i < tokens.length; i++) {
        tokens[i] = CreateBlindToken();
    }
    return tokens;
}

// Creates an issuance request for the current set of stored tokens. The format
// is base64(json(BlindTokenRequest)) where BlindTokenRequest
// corresponds to the following Go struct:
//
// type BlindTokenRequest struct {
//      Type     ReqType  `json:"type"`
//      Contents [][]byte `json:"contents"`
// }
//
// Note that Go will automatically render and decode []byte as base64 encoded
// strings.
//
// For an issuance request, type will be "Issue" and the contents will be a
// list of base64-encoded marshaled curve points. We can transmit compressed
// curve points here because the service code knows how to decompress them, but
// should remember we use uncompressed points for all key derivations.
function BuildIssueRequest(tokens) {
    let contents = [];
    for (var i = 0; i < tokens.length; i++) {
        const encodedPoint = crypto.compressPoint(tokens[i].point);
        contents.push(encodedPoint);
    }
    return btoa(JSON.stringify({ type: "Issue", contents: contents}));
}

/**
 * [END] token.js
 */

/**
 * [START] Other functions
 */

// Used for creating the correct encoding for storing tokens and signatures
function StoreTokens(tokens, signedPoints) {
    let storableTokens = [];
    for (var i = 0; i < tokens.length; i++) {
        let t = tokens[i];
        storableTokens[i] = getTokenEncoding(t,signedPoints[i]);
    }
    return storableTokens;
}

// SJCL points are cyclic as objects, so we have to flatten them.
function getTokenEncoding(t, curvePoint) {
    let storablePoint = crypto.encodeStorablePoint(curvePoint);
    let storableBlind = t.blind.toString();
    return { token: t.token, point: storablePoint, blind: storableBlind };
}

/**
 * [END] Other functions
 */

module.exports = {
	GenerateWrappedIssueRequest: GenerateWrappedIssueRequest,
    StoreTokens: StoreTokens,
	parseIssueResponse: parseIssueResponse,
};
