/*jshint esversion: 6 */
/*jshint node: true */

/**
 * Contains utils mimicing the background functionality needed
 * from background.js at https://github.com/cloudflare/challenge-bypass-extension
 */

"use strict";
const sjcl = require('./sjcl-local.js');
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
    signatures.forEach(function(signature) {
        let usablePoint = crypto.sec1DecodePoint(signature);
        if (usablePoint == null) {
            throw new Error("[privacy-pass]: unable to decode point " + signature + " in " + JSON.stringify(signatures));
        }
        usablePoints.push(usablePoint);
    });

    // Verify the DLEQ batch proof before handing back the usable points
    if (!crypto.verifyBatchProof(batchProof, tokens, usablePoints)) {
        throw new Error("[privacy-pass]: Unable to verify DLEQ proof.");
    }

    return usablePoints;
}

// Generates n tokens and returns a wrapped issue request
function GenerateWrappedIssueRequest(n) {
	const tokens = GenerateNewTokens(n);
	const issueReq = BuildIssueRequest(tokens);
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
function BuildRedeemHeader(token, host, path) {
    const sharedPoint = crypto.unblindPoint(token.blind, token.point);
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
}

/**
 * [END] token.js
 */

module.exports = {
	GenerateWrappedIssueRequest: GenerateWrappedIssueRequest,
	parseIssueResponse: parseIssueResponse,
};
