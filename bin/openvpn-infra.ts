#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { OpenvpnInfraStack } from '../lib/openvpn-infra-stack';

const app = new cdk.App();
new OpenvpnInfraStack(app, 'OpenvpnInfraStack');
