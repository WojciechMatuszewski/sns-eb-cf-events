# Receiving CloudFormation events

Experimenting with capturing _CloudFormation_ events and learning a thing or two along the way.

## The SNS way

- All I had to do was to add the `--notifications-arns ARN_OF_THE_TOPIC` to the deployment script

  - How is that possible? Should not IAM be involved here? Is it related to the capabilities parameter?. Nope, for the answer, read on.

  - When creating the SNS topic through the console, this policy is created

    ```json
    {
      "Version": "2008-10-17",
      "Id": "__default_policy_ID",
      "Statement": [
        {
          "Sid": "__default_statement_ID",
          "Effect": "Allow",
          "Principal": {
            "AWS": "*"
          },
          "Action": [
            "SNS:GetTopicAttributes",
            "SNS:SetTopicAttributes",
            "SNS:AddPermission",
            "SNS:RemovePermission",
            "SNS:DeleteTopic",
            "SNS:Subscribe",
            "SNS:ListSubscriptionsByTopic",
            "SNS:Publish",
            "SNS:Receive"
          ],
          "Resource": "arn:aws:sns:us-east-1:xxx:wow",
          "Condition": {
            "StringEquals": {
              "AWS:SourceOwner": "xxx"
            }
          }
        }
      ]
    }
    ```

  - The same policy is created by CDK if you create an SNS topic without any added permissions.

  - One might think that what's contained within the `Condition` block should allow any resource, user etc.. to publish to this topic.
    This is not true though as explained by Joel in [this forum thread](https://forums.aws.amazon.com/thread.jspa?threadID=229533).

  - **By default, _CloudFormation_ runs all it's actions with identity of the user who created the stack**.
    You can see this in the _CloudTrail_ events. The user that you deploy the stack with most likely has permissions to do everything, so there are no issues with posting to SNS.

  - If you tried to specify the `notification-arns` deployment option with `role-arn` that does not allow for publishing to SNS you will get an error.
    If that happens, you might not be able to deploy even after amending the role due to the changeset being stuck.

  - You are kind of in trouble if that happens. You cannot execute the _Change set_ since it contains the role that does not have permissions to push to SNS. You cannot delete it because the change set is not done. To fix the issue, I've amended the original role definition to allow SNS publishing, then executed the change set.

- It seems that all events, with no exception are pushed to the SNS topic.

- When it comes to filtering, you will most likely do that within the subscriber - presumably a Lambda function.
  The CFN payload is not really well structured for SNS level filtering as most information is encapsulated in a "Message" field that contains stringified JSON.

- What is interesting (and a bit scary) is that **if you deploy with `notification-arns` and then without it specified, the _CloudFormation_ will still try to push to the SNS topic**. I'm not sure if this is a bug within AWS CDK or maybe something else.
  What do you do in such situation? I've re-created the topic with the same name to ensure the arn is the same. I was then able to execute the _Change set_.

## The EventBridge / CloudWatch events way

- Given this event pattern (**defined on a custom bus, NOT the default one**)

  ```json
  {
    "source": ["aws.cloudformation"]
  }
  ```

  my subscriber did not receive any events.
  According to the documentation, the [_CloudFormation_ service does not sent events to EventBridge natively](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-service-event.html)

- This means that there is no way to get them without using _CloudTrial_, even with the rule attached to the default bus.
- Some questions

  - Is the default _CloudTrail_ not sufficient to trigger the EventBridge rule? [posted in this thread](https://www.reddit.com/r/aws/comments/ndlq8w/need_help_eventbridge_with_cloudtrail_events_is/).

    - Seem to be true. The default _CloudTrail_ is only used for displaying the event history. Please [refer to this documentation page](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-getting-started.html)

    > For an ongoing record of events in your AWS account, create a trail.

  - Do I have to enable _CloudWatch_ logging for the rule to get fired?

    - Seem to be partially explained in [one of the official AWS tutorials](https://docs.amazonaws.cn/en_us/eventbridge/latest/userguide/eb-ct-api-tutorial.html)

    > To record events with a detail-type value of Amazon API Call via CloudTrail, a CloudTrail trail with logging enabled is required.

    - Not true, you need to make sure you have bucket logging enabled though.

  - Can I use custom bus for CloudWatch events via CloudTrail?

    - According to my research you cannot. **For events delivered via _CloudTrail_ you have to declare a rule on the default bus**.
      This is quite a reasonable ask since all the AWS services deliver their events there.
