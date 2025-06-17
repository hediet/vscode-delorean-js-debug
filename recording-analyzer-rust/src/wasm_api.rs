use itertools::Itertools;
use wasm_bindgen::prelude::*;
extern crate console_error_panic_hook;
extern crate derive_more;
use serde::{Deserialize, Serialize};

use crate::instruction::*;

#[wasm_bindgen]
pub fn parse_recording(data: Vec<u8>) -> Recording {
    console_error_panic_hook::set_once();
    Recording { data }
}

#[wasm_bindgen]
pub struct Recording {
    data: Vec<u8>,
}

#[wasm_bindgen]
impl Recording {
    pub fn get_len(&self) -> usize {
        self.data.len()
    }

    pub fn decode(&self) -> JsValue {
        let iter = &mut self.data.iter().copied();
        let instruction_iter = create_instruction_iter(iter);
        let vec = instruction_iter.collect_vec();
        serde_wasm_bindgen::to_value(&vec).unwrap()
    }

    pub fn get_module_info(&self, module_id: u32) -> Option<String> {
        let module_id = ModuleId(module_id);

        let iter = &mut self.data.iter().copied();

        let mut current_module_id: Option<ModuleId> = None;

        loop {
            let instr = Instruction::from_iter(iter);
            match instr {
                Some(Instruction::SetModuleInfo { module_info_json }) => {
                    if current_module_id == Some(module_id) {
                        return Some(module_info_json);
                    }
                }
                Some(Instruction::SetModuleId { module_id: id }) => {
                    current_module_id = Some(id);
                }
                Some(_) => {}
                None => break,
            }
        }

        None
    }

    pub fn stack_at(&self, instruction_count: usize) -> JsValue {
        let iter = &mut self.data.iter().copied();
        let mut i = 0;

        let mut cur_module_id: Option<ModuleId> = None;
        let mut cur_block_id: Option<BlockId> = None;
        let mut stack = Vec::<(
            /* The parent block id */ Option<BlockId>,
            /* The module id */ ModuleId,
            /* The function id */ FunctionId,
        )>::new();

        loop {
            let instr = Instruction::from_iter(iter);
            //console_log!("instr: {:?}", instr);
            match instr {
                Some(Instruction::SetModuleId { module_id: id }) => {
                    cur_module_id = Some(id);
                }
                Some(Instruction::CallFunction { function_id }) => {
                    i += 1;
                    stack.push((cur_block_id, cur_module_id.unwrap(), function_id));
                    cur_block_id = None;
                }
                Some(Instruction::ReachedBlock { block_id: id }) => {
                    i += 1;
                    cur_block_id = Some(BlockId(id));
                }
                Some(Instruction::ReturnFunction) => {
                    let item = stack.pop().unwrap();
                    cur_block_id = item.0;
                }
                Some(_) => {}
                None => break,
            };

            if i >= instruction_count {
                break;
            }
        }

        let mut frames = Vec::<StackFrame>::new();

        for (cur, next) in stack.into_iter().map(Some).chain([None]).tuple_windows() {
            match (cur, next) {
                (Some((_block_id, module_id, function_id)), Some((block_id, _, _))) => {
                    frames.push(StackFrame {
                        module_id: module_id,
                        function_id,
                        block_id: block_id,
                    })
                }
                (Some((_block_id, module_id, fn_id)), None) => frames.push(StackFrame {
                    module_id: module_id,
                    function_id: fn_id,
                    block_id: cur_block_id,
                }),
                (None, _) => panic!("cannot happen"),
            }
        }

        let stack = Stack { frames };
        serde_wasm_bindgen::to_value(&stack).unwrap()
    }
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Stack {
    pub frames: Vec<StackFrame>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct StackFrame {
    pub module_id: ModuleId,
    pub function_id: FunctionId,
    /* The current block_id if we are in any */
    pub block_id: Option<BlockId>,
}
