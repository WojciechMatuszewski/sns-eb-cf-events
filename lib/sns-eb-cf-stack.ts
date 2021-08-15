import * as cdk from "@aws-cdk/core";
import * as sns from "@aws-cdk/aws-sns";
import * as snsSubscriptions from "@aws-cdk/aws-sns-subscriptions";
import * as lambda from "@aws-cdk/aws-lambda-nodejs";
import * as iam from "@aws-cdk/aws-iam";
import * as events from "@aws-cdk/aws-events";
import * as eventTargets from "@aws-cdk/aws-events-targets";
import { join } from "path";

/**
 * For the full reference of the CLI options that you can use, checkout this URL
 * https://github.com/aws/aws-cdk/blob/473c1d8248ae84bd8b4bb3863334e05e5328fddc/packages/aws-cdk/bin/cdk.ts#L97
 */
export class SnsEbCfStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const cfnRole = new iam.Role(this, "cfnRole", {
      assumedBy: new iam.ServicePrincipal("cloudformation.amazonaws.com"),
      inlinePolicies: {
        allowDeployment: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              resources: ["*"],
              actions: ["*"]
            })
          ]
        })
      }
    });

    const rule = new events.Rule(this, "cfnRule", {
      /**
       * CloudFormation does not natively sent events to EventBridge,
       * thus we need to intercept those events via CloudTrail.
       *
       * Since this is the case, we cannot use a custom bus.
       * The `via CloudTrail` events are only sent to the default bus.
       */
      enabled: true,
      ruleName: "allCfnEvents",
      eventPattern: {
        source: ["aws.cloudformation"],
        detailType: ["AWS API Call via CloudTrail"],
        detail: {
          eventSource: ["cloudformation.amazonaws.com"]
        }
      }
    });

    const topic = new sns.Topic(this, "topic");

    const subscriber = new lambda.NodejsFunction(this, "subscriber", {
      handler: "handler",
      entry: join(__dirname, "./sns-eb-subscriber.ts")
    });

    rule.addTarget(new eventTargets.LambdaFunction(subscriber));

    topic.addSubscription(new snsSubscriptions.LambdaSubscription(subscriber));

    new lambda.NodejsFunction(this, "resourceThatChangesss", {
      handler: "handler",
      entry: join(__dirname, "./sns-eb-subscriber.ts")
    });

    new cdk.CfnOutput(this, "topicArn", {
      value: topic.topicArn
    });

    new cdk.CfnOutput(this, "cfnRoleArn", {
      value: cfnRole.roleArn
    });
  }
}
