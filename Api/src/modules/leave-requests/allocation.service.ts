import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm/data-source/DataSource";
import { Repository } from "typeorm/repository/Repository";
import { InjectRepository } from "@nestjs/typeorm";
import { LeaveBalanceTransaction } from "@entities/leave-balance-transaction.entity";
import { LeaveTypes } from "@common/enums/leave_type.enum";
import { Logger } from "@nestjs/common";

@Injectable()
export class AllocationService {
  private readonly logger = new Logger(AllocationService.name);

  constructor(
    @InjectRepository(LeaveBalanceTransaction)
    private readonly balanceTransactionRepo: Repository<LeaveBalanceTransaction>,
    private readonly dataSource: DataSource,
  ) {}


  
  
}