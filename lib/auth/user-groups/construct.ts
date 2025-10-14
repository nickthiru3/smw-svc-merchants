import { Construct } from "constructs";
import { CfnUserPoolGroup } from "aws-cdk-lib/aws-cognito";
import UserPoolConstruct from "../user-pool/construct";

interface IUserGroupsConstructProps {
  readonly userPool: UserPoolConstruct;
}

class UserGroupsConstruct extends Construct {
  constructor(scope: Construct, id: string, props: IUserGroupsConstructProps) {
    super(scope, id);

    const { userPool } = props;

    new CfnUserPoolGroup(this, "CustomersGroup", {
      userPoolId: userPool.pool.userPoolId,
      groupName: "customer",
      description: "Group for customer users",
    });

    new CfnUserPoolGroup(this, "MerchantsGroup", {
      userPoolId: userPool.pool.userPoolId,
      groupName: "merchant",
      description: "Group for merchant users",
    });

    new CfnUserPoolGroup(this, "AdminsGroup", {
      userPoolId: userPool.pool.userPoolId,
      groupName: "admin",
      description: "Group for admin users",
    });
  }
}

export default UserGroupsConstruct;
