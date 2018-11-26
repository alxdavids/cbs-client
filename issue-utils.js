/*jshint esversion: 6 */
/*jshint node: true */

/**
 * Contains utils mimicing the issuance functionality needed
 * from background.js at https://github.com/privacypass/challenge-bypass-extension
 */

"use strict";
const utils = require('./utils.js');
const atob = require('atob');

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
        let usablePoint = utils.sec1DecodePoint(signature);
        if (usablePoint == null) {
            throw new Error("[privacy-pass]: unable to decode point " + signature + " in " + JSON.stringify(signatures));
        }
        usablePoints.push(usablePoint);
    });
    console.timeEnd('parse-all');

    // Verify the DLEQ batch proof before handing back the usable points
    console.time('verify-dleq');
    if (!utils.verifyProof(batchProof, tokens, usablePoints)) {
        throw new Error("[privacy-pass]: Unable to verify DLEQ proof.");
    }
    console.timeEnd('verify-dleq');

    return usablePoints;
}

// Generates n tokens and returns a wrapped issue request
function GenerateWrappedIssueRequest(n) {
    console.time('token-gen');
	const tokens = utils.GenerateNewTokens(n);
    console.timeEnd('token-gen');
    console.time('issue-req');
	const issueReq = utils.BuildIssueRequest(tokens);
    console.timeEnd('issue-req');
	return {wrap: WrapIssueRequest(issueReq), tokens: tokens};
}

// Wraps an issue request in the format needed for the
// server
function WrapIssueRequest(issueReqB64) {
	return JSON.stringify({ "bl_sig_req": issueReqB64 });
}

module.exports = {
	GenerateWrappedIssueRequest: GenerateWrappedIssueRequest,
	parseIssueResponse: parseIssueResponse,
};
