#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "@aws-cdk/core";
import { SnsEbCfStack } from "../lib/sns-eb-cf-stack";

const app = new cdk.App();
new SnsEbCfStack(app, "SnsEbCfStack");
